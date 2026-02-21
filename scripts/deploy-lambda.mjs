import 'dotenv/config';
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda';
import { IAMClient, PutRolePolicyCommand, GetRolePolicyCommand } from '@aws-sdk/client-iam';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ROLE_NAME = 'remotion-lambda-role';
const POLICY_NAME = 'remotion-lambda-policy';
const MEMORY_SIZE = 2048; // MB
const TIMEOUT = 240;      // seconds
const DISK_SIZE = 2048;   // MB

// Exact policy recommended by: npx remotion lambda policies role
const REMOTION_ROLE_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '0',
      Effect: 'Allow',
      Action: ['s3:ListAllMyBuckets'],
      Resource: ['*'],
    },
    {
      Sid: '1',
      Effect: 'Allow',
      Action: [
        's3:CreateBucket',
        's3:ListBucket',
        's3:PutBucketAcl',
        's3:GetObject',
        's3:DeleteObject',
        's3:PutObjectAcl',
        's3:PutObject',
        's3:GetBucketLocation',
      ],
      Resource: ['arn:aws:s3:::remotionlambda-*'],
    },
    {
      Sid: '2',
      Effect: 'Allow',
      Action: ['lambda:InvokeFunction'],
      Resource: ['arn:aws:lambda:*:*:function:remotion-render-*'],
    },
    {
      Sid: '3',
      Effect: 'Allow',
      Action: ['logs:CreateLogGroup'],
      Resource: ['arn:aws:logs:*:*:log-group:/aws/lambda-insights'],
    },
    {
      Sid: '4',
      Effect: 'Allow',
      Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      Resource: [
        'arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*',
        'arn:aws:logs:*:*:log-group:/aws/lambda-insights:*',
      ],
    },
  ],
};

console.log('[deploy] Starting Remotion Lambda deployment...');
console.log(`[deploy] Region: ${REGION}`);

// Step 1 — Attach Remotion policy to the Lambda role
console.log(`\n[deploy] Step 1/4 — Attaching IAM policy to ${ROLE_NAME}...`);
const iam = new IAMClient({ region: REGION });

// Check if policy already matches to avoid unnecessary puts
let alreadyCorrect = false;
try {
  const existing = await iam.send(new GetRolePolicyCommand({ RoleName: ROLE_NAME, PolicyName: POLICY_NAME }));
  alreadyCorrect = decodeURIComponent(existing.PolicyDocument) === JSON.stringify(REMOTION_ROLE_POLICY);
} catch {
  // Policy doesn't exist yet — will be created
}

if (alreadyCorrect) {
  console.log('[deploy] Policy already up to date.');
} else {
  await iam.send(new PutRolePolicyCommand({
    RoleName: ROLE_NAME,
    PolicyName: POLICY_NAME,
    PolicyDocument: JSON.stringify(REMOTION_ROLE_POLICY),
  }));
  console.log('[deploy] Policy attached. Waiting 10s for IAM propagation...');
  await new Promise((r) => setTimeout(r, 10000));
}

// Step 2 — Deploy the Lambda function
console.log('\n[deploy] Step 2/4 — Deploying Lambda function...');
const { functionName, alreadyExisted: fnExisted } = await deployFunction({
  region: REGION,
  memorySizeInMb: MEMORY_SIZE,
  timeoutInSeconds: TIMEOUT,
  diskSizeInMb: DISK_SIZE,
  createCloudWatchLogGroup: true,
});
console.log(`[deploy] Function: ${functionName} (${fnExisted ? 'already existed' : 'newly created'})`);

// Step 3 — Ensure the S3 bucket exists
console.log('\n[deploy] Step 3/4 — Ensuring S3 bucket...');
const { bucketName, alreadyExisted: bucketExisted } = await getOrCreateBucket({ region: REGION });
console.log(`[deploy] Bucket: ${bucketName} (${bucketExisted ? 'already existed' : 'newly created'})`);

// Step 4 — Deploy the base site to S3
console.log('\n[deploy] Step 4/4 — Deploying site to S3...');
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
