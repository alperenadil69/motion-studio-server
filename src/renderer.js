import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, ensureBrowser } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const VIDEOS_DIR = path.join(ROOT_DIR, 'videos');
const TMP_DIR = path.join(ROOT_DIR, 'tmp');

// Ensure output directories exist at module load time
mkdirSync(VIDEOS_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

// --- Template builders ---

function buildRootJsx(durationInFrames, fps) {
  return `import { Composition } from 'remotion';
import { MainComposition } from './Component';

export const Root = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainComposition}
      durationInFrames={${durationInFrames}}
      fps={${fps}}
      width={1920}
      height={1080}
    />
  );
};
`;
}

const INDEX_JSX = `import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
`;

// --- Webpack override: ensure node_modules resolve from project root ---

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

// --- Chrome options for Docker/Railway compatibility ---
// In containers: no sandbox (no root privileges), use /tmp instead of /dev/shm
// (Docker limits /dev/shm to 64 MB which causes Chrome to crash mid-render),
// and fall back to software GL so no GPU is required.
const CHROMIUM_OPTIONS = {
  gl: 'swangle',         // software rasterizer — no GPU needed
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',   // ← key fix: avoids the 64 MB /dev/shm limit
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
  ],
};

// --- Browser initialization ---

let browserReady = false;

export async function initBrowser() {
  if (browserReady) return;
  console.log('[browser] Ensuring Chrome is available...');
  await ensureBrowser();
  browserReady = true;
  console.log('[browser] Ready.');
}

// --- Main render function ---

export async function renderVideo(componentCode, durationInFrames = 240, fps = 30) {
  const id = uuidv4();
  const tmpDir = path.join(TMP_DIR, id);
  const outputPath = path.join(VIDEOS_DIR, `${id}.mp4`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    // Write the three files that form a complete Remotion project
    await Promise.all([
      fs.writeFile(path.join(tmpDir, 'Component.jsx'), componentCode, 'utf-8'),
      fs.writeFile(path.join(tmpDir, 'Root.jsx'), buildRootJsx(durationInFrames, fps), 'utf-8'),
      fs.writeFile(path.join(tmpDir, 'index.jsx'), INDEX_JSX, 'utf-8'),
    ]);

    // Bundle
    console.log(`[renderer:${id}] Bundling with webpack...`);
    const serveUrl = await bundle({
      entryPoint: path.join(tmpDir, 'index.jsx'),
      webpackOverride,
    });

    // Resolve composition (launches headless Chrome to evaluate the component tree)
    console.log(`[renderer:${id}] Resolving composition...`);
    const composition = await selectComposition({
      serveUrl,
      id: 'MainVideo',
      inputProps: {},
      chromiumOptions: CHROMIUM_OPTIONS,
    });

    // Render
    console.log(`[renderer:${id}] Rendering ${durationInFrames} frames @ ${fps}fps...`);
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {},
      chromiumOptions: CHROMIUM_OPTIONS,
      timeoutInMilliseconds: 60000,   // 60s per frame (default 30s — generous for complex components)
      onProgress: ({ renderedFrames, encodedFrames }) => {
        process.stdout.write(
          `\r[renderer:${id}] rendered=${renderedFrames}  encoded=${encodedFrames}   `
        );
      },
    });

    process.stdout.write('\n');
    console.log(`[renderer:${id}] Done → videos/${id}.mp4`);

    return id;
  } finally {
    // Always clean up the temp source files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
