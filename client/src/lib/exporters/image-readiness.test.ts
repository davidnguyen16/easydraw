import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForDocumentImages, waitForImageReadiness, type ImageReadiness } from './image-readiness';

afterEach(() => vi.useRealTimers());

describe('custom image export readiness', () => {
  it('waits for rendered textures after downloaded bytes become available', async () => {
    vi.useFakeTimers();
    let state: ImageReadiness = { state: 'loading' };
    const read = vi.fn(() => [state]);
    const finished = vi.fn();
    const pending = waitForImageReadiness(read).then(finished);
    await vi.advanceTimersByTimeAsync(100);
    expect(finished).not.toHaveBeenCalled();
    state = { state: 'ready' };
    await vi.advanceTimersByTimeAsync(25);
    await pending;
    expect(finished).toHaveBeenCalledOnce();
    expect(read.mock.calls.length).toBeGreaterThan(1);
  });

  it('fails visibly when any placed image is unavailable', async () => {
    await expect(waitForImageReadiness(() => [{ state: 'ready' }, { state: 'error', error: 'Image access was revoked.' }])).rejects.toThrow('Image access was revoked.');
  });

  it('bounds loading waits rather than producing an incomplete export', async () => {
    vi.useFakeTimers();
    const result = expect(waitForImageReadiness(() => [{ state: 'loading' }], 100)).rejects.toThrow('still loading');
    await vi.advanceTimersByTimeAsync(100);
    await result;
  });

  it('does not require assets in a diagram without images', async () => {
    await expect(waitForImageReadiness(() => [])).resolves.toBeUndefined();
  });

  it('decodes actual document images and rejects broken image bytes', async () => {
    const decode = vi.fn().mockRejectedValue(new Error('Bad PNG'));
    const root = { querySelectorAll: (selector: string) => selector === 'img' ? [{ decode }] : [] } as unknown as HTMLElement;
    await expect(waitForDocumentImages(root)).rejects.toThrow('could not be loaded');
    expect(decode).toHaveBeenCalledOnce();
  });
});
