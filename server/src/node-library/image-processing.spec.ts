import sharp from 'sharp';
import { processUploadedImage, sanitizeStaticSvg } from './image-processing';
import { InvalidUploadedFileError } from './s3-assets.service';

const svg = (contents: string, attributes = '') =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16" ${attributes}>${contents}</svg>`,
  );

describe('custom node image validation', () => {
  it('decodes a static SVG into a real PNG and thumbnail', async () => {
    const result = await processUploadedImage(
      svg('<rect width="24" height="16" fill="#ff0000"/>'),
      'image/svg+xml',
      1000,
    );
    expect(result.width).toBe(24);
    expect(result.height).toBe(16);
    expect((await sharp(result.image).metadata()).format).toBe('png');
    expect((await sharp(result.thumbnail).metadata()).format).toBe('png');
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('allows local gradients without allowing resource imports', () => {
    expect(() =>
      sanitizeStaticSvg(
        svg(
          '<defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient></defs><rect width="4" height="4" fill="url(#paint)"/>',
        ),
      ),
    ).not.toThrow();
  });

  it.each([
    ['script', '<script>alert(1)</script>', ''],
    ['foreignObject', '<foreignObject><div>unsafe</div></foreignObject>', ''],
    ['event handler', '<rect width="4" height="4" onclick="alert(1)"/>', ''],
    ['image URL', '<image href="https://example.com/private"/>', ''],
    ['use', '<use href="#loop"/>', ''],
    ['inline style', '<rect style="fill:red"/>', ''],
    ['stylesheet', '<style>@import url(https://example.com/)</style>', ''],
    ['animation', '<animate attributeName="fill"/>', ''],
    [
      'external paint',
      '<rect fill="url(https://example.com/a.svg#paint)"/>',
      '',
    ],
    [
      'obfuscated external paint',
      '<rect fill="url(&#x68;ttps://example.com/)"/>',
      '',
    ],
    ['CSS escapes', '<rect fill="url(\\68ttps://example.com/)"/>', ''],
    ['namespaced script', '<evil:script xmlns:evil="urn:evil"/>', ''],
    ['data paint', '<rect fill="url(data:image/svg+xml,test)"/>', ''],
    ['base URL', '<rect fill="red"/>', 'xml:base="https://example.com/"'],
    ['filter', '<filter id="x"/>', ''],
  ])('rejects %s', (_name, content, attrs) => {
    expect(() => sanitizeStaticSvg(svg(content, attrs))).toThrow(
      InvalidUploadedFileError,
    );
  });

  it.each([
    '<!DOCTYPE svg [<!ENTITY test "boom">]><svg xmlns="http://www.w3.org/2000/svg">&test;</svg>',
    '<?xml-stylesheet href="http://localhost/private"?><svg xmlns="http://www.w3.org/2000/svg"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg><svg/>',
  ])('rejects malformed XML or processing directives', (source) => {
    expect(() => sanitizeStaticSvg(Buffer.from(source))).toThrow(
      InvalidUploadedFileError,
    );
  });

  it('rejects excessive SVG bytes and nesting', () => {
    expect(() => sanitizeStaticSvg(Buffer.alloc(1024 * 1024 + 1))).toThrow(
      /1 MiB/,
    );
    expect(() =>
      sanitizeStaticSvg(svg(`${'<g>'.repeat(51)}${'</g>'.repeat(51)}`)),
    ).toThrow(/complex/);
  });

  it('checks actual format, not the declared MIME type', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#000000' },
    })
      .png()
      .toBuffer();
    await expect(processUploadedImage(png, 'image/jpeg', 1000)).rejects.toThrow(
      /MIME/,
    );
    await expect(
      processUploadedImage(Buffer.from('not an image'), 'image/png', 1000),
    ).rejects.toThrow(/decoded safely/);
  });

  it('rejects excessive decoded dimensions', async () => {
    await expect(
      processUploadedImage(
        svg('<rect width="24" height="16"/>'),
        'image/svg+xml',
        100,
      ),
    ).rejects.toThrow(InvalidUploadedFileError);
  });

  it.each(['png', 'jpeg', 'webp'] as const)(
    'normalizes real %s images',
    async (format) => {
      const input = await sharp({
        create: { width: 20, height: 10, channels: 4, background: '#4488aa' },
      })
        .toFormat(format)
        .toBuffer();
      const result = await processUploadedImage(input, `image/${format}`, 1000);
      expect(result.width).toBe(20);
      expect(result.height).toBe(10);
      expect((await sharp(result.image).metadata()).format).toBe('png');
    },
  );
});
