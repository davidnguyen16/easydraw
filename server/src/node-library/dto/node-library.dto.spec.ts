import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateSectionDto,
  CreateUploadDto,
  ResolveAssetsDto,
  UpdateNodeDto,
  UpdateSectionDto,
} from './node-library.dto';

describe('custom node API input validation', () => {
  it('trims section names and rejects empty ones', async () => {
    const valid = plainToInstance(CreateSectionDto, { name: '  Factory  ' });
    expect(valid.name).toBe('Factory');
    expect(await validate(valid)).toHaveLength(0);
    expect(
      await validate(plainToInstance(CreateSectionDto, { name: '   ' })),
    ).not.toHaveLength(0);
  });

  it.each([{ name: null }, { sortOrder: null }, { sortOrder: -1 }])(
    'rejects invalid optional patches: %j',
    async (patch) => {
      expect(
        await validate(plainToInstance(UpdateSectionDto, patch)),
      ).not.toHaveLength(0);
    },
  );

  it('rejects builtin IDs and null destination sections', async () => {
    expect(
      await validate(plainToInstance(UpdateNodeDto, { sectionId: 'basic' })),
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(UpdateNodeDto, { sectionId: null })),
    ).not.toHaveLength(0);
  });

  it('allows only supported MIME types and nonzero integer sizes', async () => {
    expect(
      await validate(
        plainToInstance(CreateUploadDto, {
          fileName: 'bad.html',
          contentType: 'text/html',
          byteSize: 1,
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateUploadDto, {
          fileName: 'image.png',
          contentType: 'image/png',
          byteSize: 0,
        }),
      ),
    ).not.toHaveLength(0);
  });

  it('bounds and validates asset resolution requests', async () => {
    expect(
      await validate(plainToInstance(ResolveAssetsDto, { assetIds: [] })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ResolveAssetsDto, { assetIds: ['invalid/path'] }),
      ),
    ).not.toHaveLength(0);
    const id = '63301bbe-0a6a-40f2-a06c-cad694be28dc';
    expect(
      await validate(plainToInstance(ResolveAssetsDto, { assetIds: [id, id] })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ResolveAssetsDto, { assetIds: [id], variant: 'image' }),
      ),
    ).toHaveLength(0);
  });
});
