export interface ImageReadiness {
  state: 'loading' | 'ready' | 'error';
  error?: string;
}

const IMAGE_TIMEOUT_MS = 20_000;

/** Read fresh render state: fetched bytes can be ready before React/Three renders them. */
export async function waitForImageReadiness(
  readStates: () => readonly ImageReadiness[],
  timeoutMs = IMAGE_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const states = readStates();
    const failed = states.find((item) => item.state === 'error');
    if (failed) throw new Error(failed.error || 'A custom image is unavailable. Restore access to it before exporting.');
    if (states.every((item) => item.state === 'ready')) return;
    if (Date.now() >= deadline) throw new Error('Custom images are still loading. Try exporting again when they are ready.');
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
}

/** Only document images participate; unrelated library thumbnails cannot block export. */
export async function waitForDocumentImages(root: HTMLElement): Promise<void> {
  await waitForImageReadiness(() => Array.from(root.querySelectorAll<HTMLElement>('[data-custom-image-state]')).map((item) => ({
    state: item.dataset.customImageState === 'ready' ? 'ready' : item.dataset.customImageState === 'error' ? 'error' : 'loading',
    error: item.dataset.customImageError,
  })));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(Array.from(root.querySelectorAll('img')).map(async (image) => {
        try {
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image');
        } catch {
          throw new Error('A diagram image could not be loaded. Try again before exporting.');
        }
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Diagram images are still loading. Try exporting again shortly.')), IMAGE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
