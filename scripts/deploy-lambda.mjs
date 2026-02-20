import 'dotenv/config';
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const REGION = process.env.AWS_REGION || 'us-east-1';
const MEMORY_SIZE = 2048; // MB
const TIMEOUT = 120;      // seconds
const DISK_SIZE = 2048;   // MB

console.log('[deploy] Starting Remotion Lambda deployment...');
console.log(`[deploy] Region: ${REGION}`);

// Step 1 — Deploy the Lambda function
console.log('\n[deploy] Step 1/2 — Deploying Lambda function...');
const { functionName, alreadyExisted: fnExisted } = await deployFunction({
  region: REGION,
  memorySizeInMb: MEMORY_SIZE,
  timeoutInSeconds: TIMEOUT,
  diskSizeInMb: DISK_SIZE,
  createCloudWatchLogGroup: true,
});

console.log(`[deploy] Function: ${functionName} (${fnExisted ? 'already existed' : 'newly created'})`);

// Step 2 — Ensure the S3 bucket exists
console.log('\n[deploy] Step 2/3 — Ensuring S3 bucket...');
const { bucketName, alreadyExisted: bucketExisted } = await getOrCreateBucket({ region: REGION });
console.log(`[deploy] Bucket: ${bucketName} (${bucketExisted ? 'already existed' : 'newly created'})`);

// Step 3 — Deploy the site (Remotion bundle) to S3
console.log('\n[deploy] Step 3/3 — Deploying site to S3...');
const { serveUrl, siteName } = await deploySite({
  region: REGION,
  bucketName,
  entryPoint: path.join(ROOT_DIR, 'src', 'lambda-entry', 'index.jsx'),
  siteName: 'motion-studio',
});

console.log(`[deploy] Site: ${siteName}`);
console.log('\n========================================');
console.log('DEPLOYMENT COMPLETE — add to your .env:');
console.log('========================================');
console.log(`REMOTION_FUNCTION_NAME=${functionName}`);
console.log(`REMOTION_SERVE_URL=${serveUrl}`);
console.log(`AWS_REGION=${REGION}`);
console.log('========================================\n');
