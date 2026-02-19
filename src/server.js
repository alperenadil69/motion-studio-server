import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateComponent } from './claude.js';
import { renderVideo, initBrowser } from './renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Serve rendered videos
app.use('/videos', express.static(path.join(ROOT_DIR, 'videos')));

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// POST /generate
// Body: { "prompt": "string" }
// ---------------------------------------------------------------------------
app.post('/generate', async (req, res) => {
  const { prompt } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Body must contain a non-empty "prompt" string.' });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt must be under 2000 characters.' });
  }

  const trimmed = prompt.trim();
  console.log(`\n[request] "${trimmed.slice(0, 100)}..."`);

  try {
    // 1. Generate the Remotion component with Claude
    const { component_code, duration_in_frames, fps, title } = await generateComponent(trimmed);

    // 2. Render the video with Remotion
    const videoId = await renderVideo(component_code, duration_in_frames, fps);

    // 3. Return the result
    const url = `${BASE_URL}/videos/${videoId}.mp4`;
    return res.json({
      success: true,
      id: videoId,
      title,
      url,
      duration_seconds: parseFloat((duration_in_frames / fps).toFixed(2)),
      fps,
    });
  } catch (err) {
    console.error('[error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Video generation failed.',
      details: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
console.log('Initialising browser...');
await initBrowser();

app.listen(PORT, () => {
  console.log(`\nMotion Studio Server ready`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Generate: POST http://localhost:${PORT}/generate`);
  console.log(`            Body: { "prompt": "your creative brief" }\n`);
});
