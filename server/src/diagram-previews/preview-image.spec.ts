import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { processPreviewImage } from './preview-image';

const dataUrl = (bytes: Buffer) =>
  `data:image/png;base64,${bytes.toString('base64')}`;
const png = (width = 20, height = 10) =>
  sharp({
    create: { width, height, channels: 4, background: '#4488aa' },
  })
    .png()
    .toBuffer();

describe('preview PNG pipeline', () => {
  it('fails fast on concurrent decoding and releases its slot afterwards', async () => {
    const input = dataUrl(await png());
    const first = processPreviewImage(input, 20, 10);
    await expect(processPreviewImage(input, 20, 10)).rejects.toMatchObject({
      code: 'image_processing_busy',
    });
    await first;
    await expect(processPreviewImage(input, 20, 10)).resolves.toMatchObject({
      width: 20,
      height: 10,
    });
  });

  it('decodes and re-encodes the full image deterministically with no metadata', async () => {
    const source = await sharp(await png())
      .withMetadata()
      .png()
      .toBuffer();
    const original = Buffer.from(source);
    const a = await processPreviewImage(dataUrl(source), 20, 10);
    const b = await processPreviewImage(dataUrl(source), 20, 10);
    expect(source).toEqual(original);
    expect(a.source).toEqual(b.source);
    expect(a.modelInput).toEqual(b.modelInput);
    expect(a.width).toBe(20);
    expect(a.height).toBe(10);
    expect(a.byteSize).toBe(a.source.length);
    expect(a.sourceSHA256).toBe(
      createHash('sha256').update(a.source).digest('hex'),
    );
    expect(a.modelInputSHA256).toBe(
      createHash('sha256').update(a.modelInput).digest('hex'),
    );
    const metadata = await sharp(a.source).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('downscales only the model image without cropping or enlarging', async () => {
    const result = await processPreviewImage(
      dataUrl(await png(4096, 20)),
      4096,
      20,
    );
    expect(result.width).toBe(4096);
    expect(result.height).toBe(20);
    expect(result.modelInputWidth).toBe(2048);
    expect(result.modelInputHeight).toBe(10);
    const small = await processPreviewImage(dataUrl(await png()), 20, 10);
    expect(small.modelInputWidth).toBe(20);
    expect(small.modelInputHeight).toBe(10);
  });

  it('preserves source transparency but sends a white-background model image', async () => {
    const transparent = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const result = await processPreviewImage(dataUrl(transparent), 2, 2);
    expect((await sharp(result.source).metadata()).hasAlpha).toBe(true);
    const modelPixels = await sharp(result.modelInput).raw().toBuffer();
    expect([...modelPixels]).toEqual(Array.from({ length: 12 }, () => 255));
  });

  it.each([
    ['', 20, 10, 'invalid_image'],
    ['data:image/jpeg;base64,AAAA', 20, 10, 'invalid_image'],
    ['data:image/png;base64,AA=A', 20, 10, 'invalid_image'],
    ['data:image/png;base64,AAA', 20, 10, 'invalid_image'],
    ['data:image/png;base64,AAAA\n', 20, 10, 'invalid_image'],
    ['data:image/png;base64,AB==', 20, 10, 'invalid_image'],
    ['', 0, 10, 'invalid_dimensions'],
    ['', 10.5, 10, 'invalid_dimensions'],
    ['', 8193, 10, 'invalid_dimensions'],
    ['', 4001, 4000, 'invalid_dimensions'],
  ])(
    'rejects invalid image encoding or declared dimensions',
    async (image, width, height, code) => {
      await expect(
        processPreviewImage(image, width, height),
      ).rejects.toMatchObject({ code });
    },
  );

  it('rejects excessive bytes before decoding', async () => {
    await expect(
      processPreviewImage(dataUrl(Buffer.alloc(4 * 1024 * 1024 + 1)), 20, 10),
    ).rejects.toMatchObject({ code: 'image_too_large' });
  });

  it('verifies actual dimensions and PNG contents', async () => {
    await expect(
      processPreviewImage(dataUrl(await png()), 21, 10),
    ).rejects.toMatchObject({ code: 'invalid_dimensions' });
    const jpeg = await sharp(await png())
      .jpeg()
      .toBuffer();
    await expect(
      processPreviewImage(dataUrl(jpeg), 20, 10),
    ).rejects.toMatchObject({ code: 'invalid_image' });
  });

  it('rejects truncated PNGs, appended contents, and APNG chunks', async () => {
    const input = await png();
    await expect(
      processPreviewImage(dataUrl(input.subarray(0, input.length - 5)), 20, 10),
    ).rejects.toMatchObject({ code: 'invalid_image' });
    await expect(
      processPreviewImage(
        dataUrl(Buffer.concat([input, Buffer.from('junk')])),
        20,
        10,
      ),
    ).rejects.toMatchObject({ code: 'invalid_image' });
    // Container validation rejects animation before any frame is decoded.
    const animationChunk = Buffer.alloc(20);
    animationChunk.writeUInt32BE(8, 0);
    animationChunk.write('acTL', 4, 'ascii');
    const animated = Buffer.concat([
      input.subarray(0, 33),
      animationChunk,
      input.subarray(33),
    ]);
    await expect(
      processPreviewImage(dataUrl(animated), 20, 10),
    ).rejects.toMatchObject({ code: 'invalid_image' });
  });
});
