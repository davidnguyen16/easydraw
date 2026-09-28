/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Jest SDK mocks. */
import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InvalidUploadedFileError, S3AssetsService } from './s3-assets.service';

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual<object>('@aws-sdk/client-s3'),
  S3Client: jest.fn(),
}));
jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

describe('S3AssetsService', () => {
  const originalRegion = process.env.AWS_REGION;
  const originalBucket = process.env.AWS_S3_ASSETS_BUCKET;
  let send: jest.Mock;
  let service: S3AssetsService;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_REGION = 'ap-southeast-2';
    process.env.AWS_S3_ASSETS_BUCKET = 'unit-test-private-bucket';
    send = jest.fn();
    jest
      .mocked(S3Client)
      .mockImplementation(() => ({ send }) as unknown as S3Client);
    service = new S3AssetsService();
  });
  afterAll(() => {
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
    if (originalBucket === undefined) delete process.env.AWS_S3_ASSETS_BUCKET;
    else process.env.AWS_S3_ASSETS_BUCKET = originalBucket;
  });

  it('fails clearly when real S3 is not configured', () => {
    delete process.env.AWS_S3_ASSETS_BUCKET;
    expect(() => service.requireConfiguration()).toThrow(/private Amazon S3/);
    expect(S3Client).not.toHaveBeenCalled();
  });

  it('signs only the server-generated key, MIME type, exact size and short TTL', async () => {
    jest
      .mocked(createPresignedPost)
      .mockResolvedValue({ url: 'https://example.invalid', fields: {} });
    await service.createUpload('pending/owner/asset/key', 'image/png', 123);
    expect(createPresignedPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Bucket: 'unit-test-private-bucket',
        Key: 'pending/owner/asset/key',
        Expires: 300,
        Conditions: expect.arrayContaining([
          ['content-length-range', 123, 123],
          ['eq', '$Content-Type', 'image/png'],
        ]),
      }),
    );
    expect(
      jest.mocked(createPresignedPost).mock.calls[0][1].Fields,
    ).not.toHaveProperty('acl');
  });

  it('checks HEAD then pins GET to the exact checked ETag', async () => {
    send.mockResolvedValueOnce({
      ContentLength: 3,
      ContentType: 'image/png',
      ETag: 'checked-etag',
    });
    send.mockResolvedValueOnce({ Body: Readable.from([Buffer.from('abc')]) });
    await expect(
      service.readUpload('pending/a', 3, 'image/png'),
    ).resolves.toEqual(Buffer.from('abc'));
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[1][0].input.IfMatch).toBe('checked-etag');
  });

  it('rejects mismatched size without downloading a body', async () => {
    send.mockResolvedValueOnce({
      ContentLength: 100,
      ContentType: 'image/png',
    });
    await expect(
      service.readUpload('pending/a', 3, 'image/png'),
    ).rejects.toThrow(InvalidUploadedFileError);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops downloading when a stream exceeds the reserved bytes', async () => {
    send.mockResolvedValueOnce({
      ContentLength: 3,
      ContentType: 'image/png',
      ETag: 'etag',
    });
    send.mockResolvedValueOnce({
      Body: Readable.from([Buffer.from('abcdef')]),
    });
    await expect(
      service.readUpload('pending/a', 3, 'image/png'),
    ).rejects.toThrow(/exceeds/);
  });

  it('rejects truncated uploaded content', async () => {
    send.mockResolvedValueOnce({
      ContentLength: 3,
      ContentType: 'image/png',
      ETag: 'etag',
    });
    send.mockResolvedValueOnce({ Body: Readable.from([Buffer.from('a')]) });
    await expect(
      service.readUpload('pending/a', 3, 'image/png'),
    ).rejects.toThrow(/incomplete/);
  });

  it('writes only normalized PNG and refuses overwriting final immutable objects', async () => {
    send.mockResolvedValue({});
    await service.putImage('assets/a/image.png', Buffer.from('png'));
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0][0].input).toMatchObject({
      ContentType: 'image/png',
      IfNoneMatch: '*',
      ContentDisposition: 'inline',
    });
  });

  it('signs private reads for fifteen minutes without exposing credentials', async () => {
    jest.mocked(getSignedUrl).mockResolvedValue('https://signed.example');
    await expect(service.signRead('assets/image.png')).resolves.toBe(
      'https://signed.example',
    );
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: 900 },
    );
  });
});
