import 'dotenv/config';
import { deploySite, deleteSite, getOrCreateBucket, renderMediaOnLambda, getRenderProgress } from '@remotion/lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, createWriteStream } from 'fs';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const VIDEOS_DIR = path.join(ROOT_DIR, 'videos');
const TMP_DIR = path.join(ROOT_DIR, 'tmp');

// Ensure output directories exist at module load time
mkdirSync(VIDEOS_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const REGION = process.env.AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;

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
      width={1280}
      height={720}
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

// --- No-op: Lambda doesn't need a local browser ---

export async function initBrowser() {
  if (!FUNCTION_NAME) {
    throw new Error('REMOTION_FUNCTION_NAME is not set. Run scripts/deploy-lambda.mjs first.');
  }
  console.log(`[lambda] Using Remotion Lambda — function: ${FUNCTION_NAME}`);
}

// --- Main render function ---

export async function renderVideo(componentCode, durationInFrames = 150, fps = 30) {
  const id = uuidv4();
  const tmpDir = path.join(TMP_DIR, id);
  const outputPath = path.join(VIDEOS_DIR, `${id}.mp4`);
  let siteName = null;
  let bucketName = null;

  try {
    if (!componentCode || typeof componentCode !== 'string') {
      throw new Error(
        `renderVideo received invalid componentCode: ${typeof componentCode}. ` +
        'This is a bug — claude.js should have validated this already.'
      );
    }
    if (!FUNCTION_NAME) {
      throw new Error('REMOTION_FUNCTION_NAME is not set in .env');
    }

    // Write the three files that form a complete Remotion project
    await fs.mkdir(tmpDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(tmpDir, 'Component.jsx'), componentCode, 'utf-8'),
      fs.writeFile(path.join(tmpDir, 'Root.jsx'), buildRootJsx(durationInFrames, fps), 'utf-8'),
      fs.writeFile(path.join(tmpDir, 'index.jsx'), INDEX_JSX, 'utf-8'),
    ]);

    // Get (or create) the Remotion S3 bucket
    ({ bucketName } = await getOrCreateBucket({ region: REGION }));

    // Bundle and deploy this render's composition to S3 as a temporary site
    siteName = `ms-render-${id}`;
    console.log(`[renderer:${id}] Bundling and deploying to S3 (site: ${siteName})...`);
    const { serveUrl } = await deploySite({
      region: REGION,
      bucketName,
      entryPoint: path.join(tmpDir, 'index.jsx'),
      siteName,
      options: { webpackOverride },
    });

    // Start the Lambda render
    console.log(`[renderer:${id}] Launching Lambda render...`);
    const { renderId, bucketName: renderBucket } = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl,
      composition: 'MainVideo',
      inputProps: {},
      codec: 'h264',
      timeoutInMilliseconds: 120000,
      framesPerLambda: 20,
    });

    // Poll until done
    console.log(`[renderer:${id}] Polling render ${renderId}...`);
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
        `\r[renderer:${id}] Lambda progress: ${Math.round(progress.overallProgress * 100)}%   `
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

    // Download the rendered MP4 from S3 to local videos dir
    console.log(`[renderer:${id}] Downloading result from S3...`);
    const s3 = new S3Client({ region: REGION });
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: outBucket, Key: outKey }));
    await pipeline(Body, createWriteStream(outputPath));

    console.log(`[renderer:${id}] Done → videos/${id}.mp4`);
    return id;

  } finally {
    // Clean up temp source files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    // Clean up temporary S3 site to avoid storage costs
    if (siteName && bucketName) {
      await deleteSite({ region: REGION, bucketName, siteName })
        .catch((e) => console.warn(`[renderer] Failed to delete temp site ${siteName}:`, e.message));
    }
  }
}
