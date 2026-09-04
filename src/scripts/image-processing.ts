import type { ImageOutputFormat } from '../data/image-compression';
import type { CropRectangle } from '../data/image-crop';
import type { ImageDimensions } from '../data/image-resize';

/** Decodes a local browser file without sending it anywhere. */
export function loadBrowserImage(file: Blob): Promise<HTMLImageElement> {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();

  return new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(sourceUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('This image could not be read.'));
    };
    image.src = sourceUrl;
  });
}

/** Renders an image into a new local Blob with optional resized dimensions. */
export async function encodeBrowserImage(
  image: CanvasImageSource,
  dimensions: ImageDimensions,
  format: ImageOutputFormat,
  quality?: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Your browser cannot prepare this image.');
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  const output = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, format, format === 'image/png' ? undefined : quality);
  });

  if (!output || output.type !== format) {
    throw new Error(`Your browser cannot create ${format.replace('image/', '').toUpperCase()} images.`);
  }

  return output;
}

/**
 * Cuts a rectangle out of a decoded image, on-device.
 *
 * It returns a canvas rather than a Blob so the result goes straight into
 * `encodeBrowserImage`, which is what keeps one decode-and-encode path for
 * every image Gizlet: the crop only changes which pixels are drawn.
 */
export function cropBrowserImage(
  image: CanvasImageSource,
  rectangle: CropRectangle,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rectangle.width;
  canvas.height = rectangle.height;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Your browser cannot prepare this image.');
  context.drawImage(
    image,
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
    0,
    0,
    rectangle.width,
    rectangle.height,
  );

  return canvas;
}

/** Checks alpha pixels before a conversion warns that JPEG will flatten them. */
export function imageHasTransparency(image: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) throw new Error('Your browser cannot inspect this image.');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true;
  }

  return false;
}
