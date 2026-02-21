import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { generateComponent } from './claude.js';
import { renderVideo, initBrowser } from './renderer.js';
import { extractCaptions } from './captions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (!process.env.BASE_URL) {
  console.warn('[warn] BASE_URL is not set — video URLs will point to localhost.');
  console.warn('[warn] On Railway: add BASE_URL=https://motion-studio-server-production.up.railway.app');
}

// ---------------------------------------------------------------------------
// In-memory job store  { jobId → job }
// ---------------------------------------------------------------------------
const jobs = new Map();

// Clean up jobs older than 2 hours every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 30 * 60 * 1000);

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------
const app = express();

// Explicit CORS — allow any origin, handle preflight
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors()); // respond to all preflight OPTIONS requests

app.use(express.json({ limit: '10kb' }));
app.use('/videos', express.static(path.join(ROOT_DIR, 'videos')));

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), activeJobs: jobs.size });
});

// ---------------------------------------------------------------------------
// Supabase helper — call Edge Function to complete a job
// ---------------------------------------------------------------------------
async function patchSupabaseJob(jobId, supabaseUrl, supabaseKey, data) {
  const url = 'https://kflhdlbbddjkurzxyumh.supabase.co/functions/v1/motion-studio-job-complete';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ job_id: jobId, ...data })
  });
  const body = await res.text();
  console.log(`[supabase] Edge Function response ${res.status}:`, body);
}

// ---------------------------------------------------------------------------
// POST /generate  →  { jobId, status: "processing" }
// Returns immediately — rendering happens in the background.
// ---------------------------------------------------------------------------
app.post('/generate', (req, res) => {
  const { prompt, job_id, supabase_url, supabase_key, brain_context, product_images, ratio } = req.body ?? {};
  console.log('[server] received body:', { prompt: prompt?.slice(0, 50), ratio });

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Body must contain a non-empty "prompt" string.' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt must be under 2000 characters.' });
  }

  const jobId = uuidv4();
  const trimmed = prompt.trim();
  const hasSupabase = job_id && supabase_url && supabase_key;

  jobs.set(jobId, {
    status: 'processing',
    step: 'Generating component with Claude…',
    prompt: trimmed.slice(0, 100),
    createdAt: Date.now(),
  });

  console.log(`\n[job:${jobId}] Started — "${trimmed.slice(0, 80)}"`);

  // Fire-and-forget — run in background, do not block the HTTP response
  (async () => {
    try {
      // Step 1 — Claude
      jobs.get(jobId).step = 'Generating component with Claude…';
      const { component_code, duration_in_frames, fps, title } = await generateComponent(trimmed, { brain_context, product_images, ratio });

      // Step 2 — Remotion
      jobs.get(jobId).step = 'Rendering video with Remotion…';
      const videoId = await renderVideo(component_code, duration_in_frames, fps, ratio);

      const url = `${BASE_URL}/videos/${videoId}.mp4`;
      const duration_seconds = parseFloat((duration_in_frames / fps).toFixed(2));

      jobs.set(jobId, {
        status: 'done',
        url,
        title,
        duration_seconds,
        fps,
        createdAt: jobs.get(jobId)?.createdAt ?? Date.now(),
      });

      console.log(`[job:${jobId}] Done → ${url}`);

      // Notify Supabase if credentials were provided
      if (hasSupabase) {
        await patchSupabaseJob(job_id, supabase_url, supabase_key, {
          status: 'done',
          video_url: url,
          title,
          duration_seconds: duration_seconds,
        });
      }
    } catch (err) {
      console.error(`[job:${jobId}] Error:`, err.message);
      jobs.set(jobId, {
        status: 'error',
        error: err.message,
        createdAt: jobs.get(jobId)?.createdAt ?? Date.now(),
      });

      if (hasSupabase) {
        await patchSupabaseJob(job_id, supabase_url, supabase_key, {
          status: 'error',
        });
      }
    }
  })();

  // Immediate response — client must poll /job/:jobId
  res.status(202).json({ success: true, jobId, status: 'processing' });
});

// ---------------------------------------------------------------------------
// GET /job/:jobId  →  { status, step?, url?, title?, error? }
// Poll this endpoint every 5 seconds until status is "done" or "error".
// ---------------------------------------------------------------------------
app.get('/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found. It may have expired (2 h TTL).' });
  }
  res.json(job);
});

// ---------------------------------------------------------------------------
// POST /captions  →  { success, words }
// ---------------------------------------------------------------------------
app.post('/captions', async (req, res) => {
  const { video_url, style, job_id, supabase_url, supabase_key } = req.body ?? {};

  if (!video_url || !job_id) {
    return res.status(400).json({ error: 'video_url and job_id are required.' });
  }

  try {
    const words = await extractCaptions(video_url, job_id);
    res.json({ success: true, words });
  } catch (err) {
    console.error(`[captions:${job_id}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

// Verify ffmpeg is available
try {
  execSync('which ffmpeg', { stdio: 'pipe' });
  console.log('[startup] ffmpeg found');
} catch {
  console.error('[startup] ffmpeg is NOT installed — /captions will not work');
}

console.log('Initialising browser…');
await initBrowser();

app.listen(PORT, () => {
  console.log(`\nMotion Studio Server ready`);
  console.log(`  Health:   GET  ${BASE_URL}/health`);
  console.log(`  Generate: POST ${BASE_URL}/generate   { "prompt": "..." }`);
  console.log(`  Captions: POST ${BASE_URL}/captions    { "video_url": "...", "job_id": "..." }`);
  console.log(`  Poll:     GET  ${BASE_URL}/job/:jobId\n`);
});
