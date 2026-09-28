import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const ASSET_URL_TTL_SECONDS = 900;
export const UPLOAD_URL_TTL_SECONDS = 300;

/** Private S3 only. Credentials come from the AWS provider chain, never the client. */
@Injectable()
export class S3AssetsService {
  private client: S3Client | undefined;

  requireConfiguration() {
    if (!process.env.AWS_REGION || !process.env.AWS_S3_ASSETS_BUCKET) {
      throw new ServiceUnavailableException(
        'Custom node uploads require AWS_REGION and AWS_S3_ASSETS_BUCKET. Configure a private Amazon S3 bucket first.',
      );
    }
  }

  private storage() {
    this.requireConfiguration();
    this.client ??= new S3Client({
      region: process.env.AWS_REGION,
      maxAttempts: 2,
    });
    return { client: this.client, bucket: process.env.AWS_S3_ASSETS_BUCKET! };
  }

  async createUpload(key: string, contentType: string, byteSize: number) {
    const { client, bucket } = this.storage();
    return createPresignedPost(client, {
      Bucket: bucket,
      Key: key,
      Expires: UPLOAD_URL_TTL_SECONDS,
      Fields: { 'Content-Type': contentType, success_action_status: '204' },
      Conditions: [
        ['eq', '$Content-Type', contentType],
        ['content-length-range', byteSize, byteSize],
        ['eq', '$success_action_status', '204'],
      ],
    });
  }

  async readUpload(
    key: string,
    expectedBytes: number,
    expectedContentType: string,
  ) {
    const { client, bucket } = this.storage();
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
      {
        abortSignal: AbortSignal.timeout(30000),
      },
    );
    if (
      head.ContentLength !== expectedBytes ||
      head.ContentType !== expectedContentType
    ) {
      throw new InvalidUploadedFileError(
        'Uploaded file size or MIME type differs from its reservation.',
      );
    }
    // If-Match pins the GET to the object checked by HEAD, even if a POST is replayed.
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: head.ETag }),
      {
        abortSignal: AbortSignal.timeout(30000),
      },
    );
    if (!result.Body)
      throw new InvalidUploadedFileError('Uploaded file is empty.');
    const stream = result.Body as AsyncIterable<Uint8Array> & {
      destroy?: () => void;
    };
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      for await (const chunk of stream) {
        length += chunk.length;
        if (length > expectedBytes)
          throw new InvalidUploadedFileError(
            'Uploaded file exceeds its reserved size.',
          );
        chunks.push(Buffer.from(chunk));
      }
    } finally {
      stream.destroy?.();
    }
    if (length !== expectedBytes)
      throw new InvalidUploadedFileError('Uploaded file is incomplete.');
    return Buffer.concat(chunks, length);
  }

  async putImage(
    key: string,
    body: Buffer,
    cacheControl = 'private, max-age=86400',
  ) {
    const { client, bucket } = this.storage();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'image/png',
        CacheControl: cacheControl,
        ContentDisposition: 'inline',
        IfNoneMatch: '*',
      }),
      { abortSignal: AbortSignal.timeout(30000) },
    );
  }

  async deletePendingOrUnpublished(key: string) {
    const { client, bucket } = this.storage();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(30000),
    });
  }

  async signRead(key: string, ttlSeconds = ASSET_URL_TTL_SECONDS) {
    const { client, bucket } = this.storage();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      {
        expiresIn: Math.max(1, Math.min(ASSET_URL_TTL_SECONDS, ttlSeconds)),
      },
    );
  }
}

export class InvalidUploadedFileError extends Error {}
