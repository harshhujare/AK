import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME!;

/**
 * Upload a file (Buffer or Readable stream) to AWS S3.
 * For Buffer inputs, ContentLength is set automatically — required by AWS SDK v3.
 * Never saves to disk.
 */
export async function uploadFile(
  body: Buffer | Readable,
  key: string,
  contentType = 'application/pdf'
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // ContentLength is required for streams; auto-derived from Buffer
      ...(Buffer.isBuffer(body) && { ContentLength: body.length }),
    })
  );
}

/**
 * Generate a time-limited signed URL for reading a private S3 object.
 * Default TTL: 5 minutes (300 seconds).
 * Use for secure PDF viewer — URL returned to client in-memory only.
 */
export async function getSignedViewUrl(
  key: string,
  expiresIn = 300
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Permanently delete an object from S3.
 */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Stream a private S3 object directly to the caller (for API proxy).
 * Returns the GetObjectCommandOutput so the caller can pipe Body and read ContentLength.
 */
export async function getFileStream(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return s3.send(command);
}
