import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CUSTOM_IMAGE_NODE_TYPE,
  isCustomImageNodeData,
} from '@easydraw/diagram-schema';
import type { Prisma } from '../generated/prisma/client';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Inspect only the graph's node lists; metadata we do not model is untouched. */
export function collectDiagramAssetIds(data: unknown): string[] {
  if (!record(data)) return [];
  const lists: unknown[] = Array.isArray(data.pages)
    ? data.pages.filter(record).map((page) => page.nodes)
    : [data.nodes];
  const ids = new Set<string>();
  let count = 0;
  for (const nodes of lists) {
    if (!Array.isArray(nodes)) continue;
    for (const node of nodes) {
      if (!record(node) || node.type !== CUSTOM_IMAGE_NODE_TYPE) continue;
      if (!isCustomImageNodeData(node.data)) {
        throw new BadRequestException(
          'Custom image nodes must contain a stable asset ID and valid image dimensions, not a URL.',
        );
      }
      if (++count > 2000)
        throw new BadRequestException(
          'A diagram may contain at most 2000 custom image nodes.',
        );
      ids.add(node.data.assetId);
    }
  }
  return [...ids].sort();
}

/** Same lock order as upload quota/finalization/maintenance: owner first. */
export async function lockDiagramOwner(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!rows.length) throw new NotFoundException('Account not found');
}

export async function validateDiagramAssets(
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[],
) {
  if (!ids.length) return;
  const assets = await tx.asset.findMany({
    where: { id: { in: ids }, ownerId: userId, status: 'READY' },
    select: { id: true },
  });
  if (assets.length !== ids.length) {
    // Deliberately do not disclose whether another account owns a given ID.
    throw new BadRequestException(
      'One or more images are unavailable to this account. Upload them to your own library first.',
    );
  }
}

export async function syncDiagramAssets(
  tx: Prisma.TransactionClient,
  diagramId: string,
  ids: string[],
) {
  const previous = await tx.diagramAsset.findMany({
    where: { diagramId },
    select: { assetId: true },
  });
  await tx.diagramAsset.deleteMany({
    where: { diagramId, assetId: { notIn: ids } },
  });
  if (ids.length)
    await tx.diagramAsset.createMany({
      data: ids.map((assetId) => ({ diagramId, assetId })),
      skipDuplicates: true,
    });
  // Start the cleanup grace period when an image loses its last reference,
  // not when the image was originally uploaded (undo/reopen protection).
  const touched = [
    ...new Set([...ids, ...previous.map(({ assetId }) => assetId)]),
  ];
  if (touched.length)
    await tx.asset.updateMany({
      where: { id: { in: touched } },
      data: { updatedAt: new Date() },
    });
}
