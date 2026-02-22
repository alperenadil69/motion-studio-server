import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import {
  deploySite,
  deleteSite,
  getOrCreateBucket,
  renderMediaOnLambda,
  getRenderProgress,
} from '@remotion/lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const execFileAsync = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const TMP_DIR = path.join(ROOT_DIR, 'tmp');
const REGION = process.env.AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;

const REMOTION_STYLES = [
  'heat-glow', 'elegant', 'word-pop', 'cinematic', 'emoji-auto',
  'heat', 'zodiac', 'hustle-v3', 'orion', 'cove', 'magazine',
  'betelgeuse', 'daily-mail', 'eclipse', 'suzy', 'milky-way',
  'vitamin-c', 'alcyone', 'buzz', 'thuban', 'marigold', 'closed-cap',
  'note', 'poem', 'energy', 'recess', 'messages', 'mizar', 'pulse',
  'linear', 'cartwheel-black', 'footprint-v3', 'andromeda', 'baseline',
  'cartwheel-purple', 'arion-pink', 'castor', 'techwave', 'flair',
  'aries', 'dimidium', 'fuel', 'orbitar-black', 'vitamin-b', 'lumin',
  'bold', 'minimal', 'drive', 'neon', 'elegant-classic',
  // ——— Nouveaux styles ———
  'pacific', 'scene', 'cygnus-a', 'doodle', 'blueprint',
  'freshly', 'finlay', 'runway', 'sirius', 'medusa',
  'minima', 'energy-ii', 'nova', 'garnet', 'glow',
  'monster', 'alhena', 'pollux', 'million',
];


// ---------------------------------------------------------------------------
// Remotion Lambda helpers (for premium styles)
// ---------------------------------------------------------------------------

function buildCaptionsRootJsx(durationInFrames, fps, width, height) {
  return `import { Composition } from 'remotion';
import { CaptionsComposition } from './CaptionsComposition';

export const Root = () => (
  <Composition
    id="CaptionsVideo"
    component={CaptionsComposition}
    durationInFrames={${durationInFrames}}
    fps={${fps}}
    width={${width}}
    height={${height}}
  />
);
`;
}

const CAPTIONS_INDEX_JSX = `import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
`;

function webpackOverride(config) {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      modules: [
        path.join(ROOT_DIR, 'node_modules'),
        'node_modules',
        ...(config.resolve?.modules ?? []),
      ],
    },
  };
}

async function getVideoDimensions(videoPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', videoPath,
    ]);
    const data = JSON.parse(stdout);
    const vs = data.streams.find((s) => s.codec_type === 'video');
    if (vs) {
      return {
        width: vs.width,
        height: vs.height,
        duration: parseFloat(vs.duration || '0'),
      };
    }
  } catch (e) {
    console.warn(`[captions] Could not detect video dimensions: ${e.message}`);
  }
  return { width: 1920, height: 1080, duration: 0 };
}

async function renderCaptionsWithRemotion(videoUrl, words, style, jobId, { width = 1920, height = 1080, fps = 30, emojiCues = [] } = {}) {
  const id = uuidv4();
  const tmpDir = path.join(TMP_DIR, `captions-${id}`);
  const outputPath = path.join('/tmp', `${jobId}-captioned.mp4`);
  let siteName = null;
  let bucketName = null;

  const lastWord = words[words.length - 1];
  const durationInFrames = Math.ceil((lastWord.end + 0.5) * fps);

  try {
    // 1. Write composition files to temp dir
    await fsp.mkdir(tmpDir, { recursive: true });

    const compositionSrc = path.join(__dirname, 'captions-remotion', 'CaptionsComposition.jsx');
    await fsp.copyFile(compositionSrc, path.join(tmpDir, 'CaptionsComposition.jsx'));
    await Promise.all([
      fsp.writeFile(path.join(tmpDir, 'Root.jsx'), buildCaptionsRootJsx(durationInFrames, fps, width, height), 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'index.jsx'), CAPTIONS_INDEX_JSX, 'utf-8'),
    ]);

    // 2. Get S3 bucket
    ({ bucketName } = await getOrCreateBucket({ region: REGION }));

    // 3. Bundle and deploy to S3
    siteName = `ms-captions-${id}`;
    console.log(`[captions-remotion:${jobId}] Bundling and deploying to S3 (site: ${siteName})…`);
    const { serveUrl } = await deploySite({
      region: REGION,
      bucketName,
      entryPoint: path.join(tmpDir, 'index.jsx'),
      siteName,
      options: { webpackOverride },
    });

    // 4. Start Lambda render
    console.log(`[captions-remotion:${jobId}] Launching Lambda render…`);
    const { renderId, bucketName: renderBucket } = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl,
      composition: 'CaptionsVideo',
      inputProps: { videoUrl, words, style, emojiCues },
      codec: 'h264',
      timeoutInMilliseconds: 240000,
      framesPerLambda: 60,
    });

    // 5. Poll until done
    console.log(`[captions-remotion:${jobId}] Polling render ${renderId}…`);
    let outKey, outBucket;
    while (true) {
      await new Promise((r) => setTimeout(r, 4000));
      const progress = await getRenderProgress({
        renderId,
        bucketName: renderBucket,
        functionName: FUNCTION_NAME,
        region: REGION,
      });

      process.stdout.write(
        `\r[captions-remotion:${jobId}] Lambda progress: ${Math.round(progress.overallProgress * 100)}%   `,
      );

      if (progress.fatalErrorEncountered) {
        throw new Error(progress.errors?.[0]?.message ?? 'Lambda render failed');
      }
      if (progress.done) {
        outKey = progress.outKey;
        outBucket = progress.outBucket ?? renderBucket;
        break;
      }
    }
    process.stdout.write('\n');

    // 6. Download rendered MP4 from S3
    console.log(`[captions-remotion:${jobId}] Downloading result from S3…`);
    const s3 = new S3Client({ region: REGION });
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: outBucket, Key: outKey }));
    await pipeline(Body, createWriteStream(outputPath));

    console.log(`[captions-remotion:${jobId}] Done → ${outputPath}`);
    return outputPath;

  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    if (siteName && bucketName) {
      await deleteSite({ region: REGION, bucketName, siteName })
        .catch((e) => console.warn(`[captions-remotion] Failed to delete temp site ${siteName}:`, e.message));
    }
  }
}

// ---------------------------------------------------------------------------
// Edge Function helper
// ---------------------------------------------------------------------------

async function notifyJobComplete(jobId, supabaseKey, videoUrl) {
  const url =
    'https://kflhdlbbddjkurzxyumh.supabase.co/functions/v1/motion-studio-job-complete';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ job_id: jobId, video_url: videoUrl }),
  });
  const body = await res.text();
  console.log(`[captions] Edge Function response ${res.status}:`, body);
  console.log('[captions] job_id sent to edge function:', jobId);
  console.log('[captions] video_url sent:', videoUrl);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function extractCaptions(
  videoUrl,
  jobId,
  { style = 'heat', baseUrl, supabaseUrl, supabaseKey, userId, emojiCues = [] } = {},
) {
  const videoPath = path.join('/tmp', `${jobId}.mp4`);
  const audioPath = path.join('/tmp', `${jobId}.wav`);
  const outputFilename = `${jobId}-captioned.mp4`;
  const outputPath = path.join('/tmp', outputFilename);

  try {
    // 0. Create job row in Supabase
    if (supabaseUrl && supabaseKey) {
      console.log(`[captions:${jobId}] Creating job in Supabase…`);
      const jobRes = await fetch(`${supabaseUrl}/rest/v1/motion_studio_jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          id: jobId,
          user_id: userId,
          prompt: `Captions — ${style}`,
          status: 'pending',
          ratio: 'horizontal',
        }),
      });
      console.log('[captions] job creation response status:', jobRes.status);
      const responseText = await jobRes.text();
      console.log('[captions] job creation response body:', responseText);
    }

    // 1. Download the video
    console.log(`[captions:${jobId}] Downloading video…`);
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(videoPath, buffer);
    console.log(`[captions:${jobId}] Downloaded ${buffer.length} bytes`);

    // 2. Extract audio with ffmpeg
    console.log(`[captions:${jobId}] Extracting audio…`);
    await execFileAsync('ffmpeg', [
      '-i', videoPath, '-vn', '-ar', '16000', '-ac', '1', '-y', audioPath,
    ]);
    console.log(`[captions:${jobId}] Audio extracted`);

    // 3. Transcribe with Whisper
    console.log(`[captions:${jobId}] Transcribing with Whisper…`);
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      prompt: 'Inclure toute la ponctuation : virgules, points, points d\'exclamation, points d\'interrogation.',
    });
    const words = transcription.words || [];
    console.log(`[captions] words:`, JSON.stringify(words.slice(0, 5)));

    if (words.length === 0) {
      return { words, video_url: null };
    }

    // 4. Render captions via Remotion Lambda
    console.log(`[captions:${jobId}] Using Remotion Lambda pipeline for style: ${style}`);
    const { width, height } = await getVideoDimensions(videoPath);
    await renderCaptionsWithRemotion(videoUrl, words, style, jobId, {
      width,
      height,
      fps: 30,
      emojiCues,
    });

    // 5. Serve via Railway
    const publicUrl = `${baseUrl}/captions-output/${outputFilename}`;
    console.log(`[captions:${jobId}] Serving at → ${publicUrl}`);

    // 6. Notify Edge Function
    if (supabaseKey) {
      await notifyJobComplete(jobId, supabaseKey, publicUrl);
    }

    return { words, video_url: publicUrl };
  } finally {
    for (const f of [videoPath, audioPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}
