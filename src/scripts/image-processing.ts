import type { ImageOutputFormat } from '../data/image-compression';
import { getCollageSourceRectangle, type CollagePlan } from '../data/image-collage';
import type { CropRectangle } from '../data/image-crop';
import { getOrientationDrawing, type ImageOrientation } from '../data/image-orientation';
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

/**
 * Draws a planned collage onto a canvas, on-device.
 *
 * The plan decides everything about where a picture goes; this only paints the
 * background, then draws each image into the cell it was given, filled rather
 * than fitted. The canvas is handed back so the caller can encode it with
 * `encodeBrowserImage`, which keeps one encode path for every image Gizlet: the
 * workspace preview and the downloaded file come off the same drawing.
 */
export function drawCollage(
  canvas: HTMLCanvasElement,
  plan: CollagePlan,
  images: readonly CanvasImageSource[],
  background: string,
): HTMLCanvasElement {
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Your browser cannot prepare this collage.');

  context.fillStyle = background;
  context.fillRect(0, 0, plan.width, plan.height);

  for (const cell of plan.cells) {
    const image = images[cell.index];

    if (!image) continue;

    const source = getCollageSourceRectangle(
      { width: canvasImageWidth(image), height: canvasImageHeight(image) },
      cell,
    );

    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      cell.x,
      cell.y,
      cell.width,
      cell.height,
    );
  }

  return canvas;
}

/** The natural size of whatever a canvas has been handed to draw. */
function canvasImageWidth(image: CanvasImageSource): number {
  if (image instanceof HTMLImageElement) return image.naturalWidth;
  if (image instanceof HTMLCanvasElement) return image.width;
  if (image instanceof HTMLVideoElement) return image.videoWidth;
  return 'width' in image ? Number(image.width) : 0;
}

function canvasImageHeight(image: CanvasImageSource): number {
  if (image instanceof HTMLImageElement) return image.naturalHeight;
  if (image instanceof HTMLCanvasElement) return image.height;
  if (image instanceof HTMLVideoElement) return image.videoHeight;
  return 'height' in image ? Number(image.height) : 0;
}

/**
 * Draws a decoded image in a given orientation, on-device.
 *
 * The source is drawn once, from the original pixels, however many times the
 * visitor pressed a button: the state says where the picture ends up, and this
 * puts it there in one transform. Like the crop, it hands back a canvas so the
 * result goes into `encodeBrowserImage` and every image Gizlet keeps one
 * decode-and-encode path.
 */
export function orientBrowserImage(
  image: CanvasImageSource,
  source: ImageDimensions,
  orientation: ImageOrientation,
): HTMLCanvasElement {
  const drawing = getOrientationDrawing(source, orientation);
  const canvas = document.createElement('canvas');
  canvas.width = drawing.width;
  canvas.height = drawing.height;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Your browser cannot prepare this image.');

  context.translate(drawing.centerX, drawing.centerY);
  context.rotate(drawing.rotationRadians);
  context.scale(drawing.scaleX, drawing.scaleY);
  context.drawImage(image, drawing.drawX, drawing.drawY, drawing.drawWidth, drawing.drawHeight);

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
