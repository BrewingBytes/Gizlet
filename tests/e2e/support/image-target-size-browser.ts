import {
  createBrowserTargetImageEncoder,
  encodeImageToTargetSize,
} from '../../../src/scripts/image-target-size';

declare global {
  interface Window {
    runImageTargetSizeBrowserCheck?: (
      format: 'image/jpeg' | 'image/webp',
      targetBytes: number,
    ) => Promise<{
      readonly actualBytes?: number;
      readonly attempts?: number;
      readonly blobBytes?: number;
      readonly height?: number;
      readonly kind: string;
      readonly type?: string;
      readonly width?: number;
    }>;
  }
}

window.runImageTargetSizeBrowserCheck = async (format, targetBytes) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not create a source canvas.');

  // A detailed source makes the browser actually encode pixels, rather than
  // accepting an empty canvas or a prebuilt fixture as the target candidate.
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const index = offset / 4;
    pixels.data[offset] = (index * 17) % 256;
    pixels.data[offset + 1] = (index * 31) % 256;
    pixels.data[offset + 2] = (index * 47) % 256;
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);

  let attempts = 0;
  const encoder = createBrowserTargetImageEncoder(canvas, { width: canvas.width, height: canvas.height }, format);
  const result = await encodeImageToTargetSize(
    targetBytes,
    async (quality) => {
      attempts += 1;
      return encoder(quality);
    },
  );
  if (result.kind !== 'met' && result.kind !== 'unmet') return { kind: result.kind, attempts };

  const output = await createImageBitmap(result.blob);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = output.width;
  outputCanvas.height = output.height;
  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) throw new Error('The browser could not inspect the output canvas.');
  outputContext.drawImage(output, 0, 0);
  output.close();

  return {
    kind: result.kind,
    actualBytes: result.actualBytes,
    blobBytes: result.blob.size,
    attempts,
    type: result.blob.type,
    width: outputCanvas.width,
    height: outputCanvas.height,
  };
};
