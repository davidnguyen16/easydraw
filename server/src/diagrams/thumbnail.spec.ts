import { BadRequestException } from '@nestjs/common';
import { MAX_THUMBNAIL_BYTES, parseThumbnail } from './thumbnail';

describe('parseThumbnail', () => {
  const webp = `data:image/webp;base64,${Buffer.from('RIFF....WEBP').toString('base64')}`;

  it('decodes a small raster data URL', () => {
    const image = parseThumbnail(webp);
    expect(image.type).toBe('image/webp');
    expect(Buffer.from(image.bytes).toString()).toBe('RIFF....WEBP');
  });

  it('refuses other formats and oversized images', () => {
    expect(() => parseThumbnail('data:image/svg+xml;base64,PHN2Zz4=')).toThrow(
      BadRequestException,
    );
    expect(() => parseThumbnail('https://example.com/x.png')).toThrow(
      BadRequestException,
    );
    const big = `data:image/png;base64,${Buffer.alloc(MAX_THUMBNAIL_BYTES + 1).toString('base64')}`;
    expect(() => parseThumbnail(big)).toThrow(BadRequestException);
  });
});
