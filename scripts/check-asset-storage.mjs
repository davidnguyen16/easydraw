// Read-only check: no bucket creation, object writes or credential logging.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../server/package.json', import.meta.url));
require('dotenv').config({ path: fileURLToPath(new URL('../server/.env', import.meta.url)), quiet: true });
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
if (!process.env.AWS_S3_ASSETS_BUCKET || !process.env.AWS_REGION) {
  console.error('S3 is not configured. Set AWS_REGION and AWS_S3_ASSETS_BUCKET on the server.');
  process.exitCode = 1;
} else {
  const client = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 1 });
  try {
    await client.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_ASSETS_BUCKET }), {
      abortSignal: AbortSignal.timeout(10_000),
    });
    console.log('S3 bucket is reachable with the server credential chain. No objects were written.');
  } catch (error) {
    console.error(`S3 check failed (${error.name}, HTTP ${error.$metadata?.httpStatusCode ?? 'n/a'}). Verify bucket, region and IAM credentials/permissions. No objects were written.`);
    process.exitCode = 1;
  } finally { client.destroy(); }
}
