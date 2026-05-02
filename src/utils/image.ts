export interface ImageDims {
  width: number;
  height: number;
}

export async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  // ImageBitmap is supported in modern browsers (incl. iOS 15+)
  return await createImageBitmap(blob);
}

export async function readImageDims(blob: Blob): Promise<ImageDims> {
  const bmp = await blobToImageBitmap(blob);
  const dims = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  return dims;
}

interface RenderOpts {
  maxLongSide?: number;
  type?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
}

export async function renderToBlob(
  source: ImageBitmap | HTMLCanvasElement,
  { maxLongSide, type = 'image/jpeg', quality = 0.92 }: RenderOpts = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const srcW = source.width;
  const srcH = source.height;
  let outW = srcW;
  let outH = srcH;
  if (maxLongSide && Math.max(srcW, srcH) > maxLongSide) {
    const scale = maxLongSide / Math.max(srcW, srcH);
    outW = Math.round(srcW * scale);
    outH = Math.round(srcH * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-2d unavailable');
  ctx.drawImage(source as CanvasImageSource, 0, 0, outW, outH);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality)
  );
  if (!blob) throw new Error('toBlob failed');
  return { blob, width: outW, height: outH };
}

export async function makeThumbnail(blob: Blob, longSide = 320): Promise<Blob> {
  const bmp = await blobToImageBitmap(blob);
  const { blob: out } = await renderToBlob(bmp, {
    maxLongSide: longSide,
    type: 'image/jpeg',
    quality: 0.7,
  });
  bmp.close?.();
  return out;
}

const MAX_ORIGINAL_LONG_SIDE = 4096;
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;

export async function normalizeOriginal(blob: Blob): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const bmp = await blobToImageBitmap(blob);
  const longSide = Math.max(bmp.width, bmp.height);
  const needsResize = longSide > MAX_ORIGINAL_LONG_SIDE || blob.size > MAX_ORIGINAL_BYTES;
  if (!needsResize) {
    bmp.close?.();
    return { blob, width: bmp.width, height: bmp.height };
  }
  const out = await renderToBlob(bmp, {
    maxLongSide: MAX_ORIGINAL_LONG_SIDE,
    type: 'image/jpeg',
    quality: 0.9,
  });
  bmp.close?.();
  return out;
}
