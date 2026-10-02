import {
  defaultBackgroundAnchor,
  defaultBackgroundColour,
  defaultBackgroundFit,
  getBackgroundOutputFilename,
  planImageBackground,
  validateBackgroundCanvas,
  type BackgroundFit,
  type BackgroundPlan,
} from '../data/image-background';
import { getOutputFilename, type ImageOutputFormat } from '../data/image-compression';
import { getConversionOutputFilename } from '../data/image-conversion';
import {
  defaultFlowCropAspectRatio,
  getCenteredCrop,
  getCropAspectRatio,
  getCropOutputFilename,
  type CropRectangle,
  type FlowCropAspectRatioName,
} from '../data/image-crop';
import { getCleanedImageFilename } from '../data/image-metadata';
import {
  defaultOrientationPreset,
  getOrientationOutputFilename,
  getOrientationPreset,
  getOrientedDimensions,
  validateOrientedImage,
  type ImageOrientation,
  type OrientationPresetName,
} from '../data/image-orientation';
import { getResizeOutputFilename, validateResizeDimensions, type ImageDimensions } from '../data/image-resize';
import type { AvailableFlowToolSlug } from '../data/tool-flows';
import { toolRegistry } from '../data/tools';
import {
  cropBrowserImage,
  drawImageBackground,
  encodeBrowserImage,
  loadBrowserImage,
  orientBrowserImage,
} from './image-processing';

/** What travels between image steps. A combining step turns many into one. */
export interface FlowPayload {
  readonly file: File;
  readonly width: number;
  readonly height: number;
}

/** The settings an image step reads; a flow block carries these and more. */
export interface FlowImageStep {
  readonly toolSlug: AvailableFlowToolSlug;
  readonly width?: number;
  readonly height?: number;
  readonly quality?: number;
  readonly ratio?: FlowCropAspectRatioName;
  readonly turn?: OrientationPresetName;
  readonly canvasWidth?: number;
  readonly canvasHeight?: number;
  readonly fit?: BackgroundFit;
}

/**
 * The browser work an image step does, handed in so the decisions around it —
 * which transform, which size, which name, which error — can be checked
 * without a canvas.
 */
export interface FlowImageAdapters {
  readonly load: (file: File) => Promise<HTMLImageElement>;
  readonly encode: (
    image: CanvasImageSource,
    dimensions: ImageDimensions,
    format: ImageOutputFormat,
    quality?: number,
  ) => Promise<Blob>;
  readonly crop: (image: CanvasImageSource, rectangle: CropRectangle) => CanvasImageSource;
  readonly orient: (image: CanvasImageSource, source: ImageDimensions, orientation: ImageOrientation) => CanvasImageSource;
  readonly drawBackground: (image: CanvasImageSource, plan: BackgroundPlan, background: string) => CanvasImageSource;
}

/** The on-device implementations every flow runs with. */
export const browserFlowImageAdapters: FlowImageAdapters = {
  load: loadBrowserImage,
  encode: encodeBrowserImage,
  crop: cropBrowserImage,
  orient: orientBrowserImage,
  drawBackground: (image, plan, background) => drawImageBackground(document.createElement('canvas'), image, plan, background),
};

const toolName = (toolSlug: AvailableFlowToolSlug) => {
  const tool = toolRegistry.find((candidate) => candidate.slug === toolSlug);
  if (!tool) throw new Error(`Missing Gizlet: ${toolSlug}`);
  return tool.name;
};

/** One image through one image step, keeping the dimensions it came out at. */
export async function runFlowImageStep(
  step: FlowImageStep,
  payload: FlowPayload,
  outputFormat: ImageOutputFormat,
  adapters: FlowImageAdapters = browserFlowImageAdapters,
): Promise<FlowPayload> {
  const image = await adapters.load(payload.file);
  const sourceDimensions = { width: image.naturalWidth, height: image.naturalHeight };
  if (!sourceDimensions.width || !sourceDimensions.height) throw new Error('This image has no usable dimensions.');

  let dimensions = sourceDimensions;
  if (step.toolSlug === 'resize-image') {
    dimensions = { width: Math.round(step.width ?? 0), height: Math.round(step.height ?? 0) };
    const validation = validateResizeDimensions(dimensions);
    if (validation) throw new Error(`Resize Image: ${validation}`);
  }

  // A background block is the one image step whose output size is neither
  // the picture's nor a resize of it: the canvas is the size, and the
  // picture is placed on it.
  if (step.toolSlug === 'image-background') {
    const canvas = { width: Math.round(step.canvasWidth ?? 0), height: Math.round(step.canvasHeight ?? 0) };
    const problem = validateBackgroundCanvas(canvas);

    if (problem) throw new Error(`${toolName(step.toolSlug)}: ${problem}`);

    const plan = planImageBackground(sourceDimensions, {
      canvas,
      fit: step.fit ?? defaultBackgroundFit,
      anchor: defaultBackgroundAnchor,
      offsetX: 0,
      offsetY: 0,
    });
    const drawn = adapters.drawBackground(image, plan, defaultBackgroundColour);
    const blob = await adapters.encode(drawn, plan.canvas, outputFormat);

    return {
      file: new File([blob], getBackgroundOutputFilename(payload.file.name, outputFormat), { type: blob.type }),
      ...plan.canvas,
    };
  }

  // A turn keeps every pixel it was given and only moves them, so the
  // block that does it hands on the same picture in a new orientation —
  // with its sides swapped when the turn is a quarter one.
  if (step.toolSlug === 'rotate-flip-image') {
    const problem = validateOrientedImage(sourceDimensions);

    if (problem) throw new Error(`${toolName(step.toolSlug)}: ${problem}`);

    const turned = getOrientationPreset(step.turn ?? defaultOrientationPreset);
    const oriented = getOrientedDimensions(sourceDimensions, turned);
    const blob = await adapters.encode(
      adapters.orient(image, sourceDimensions, turned),
      oriented,
      outputFormat,
    );

    return {
      file: new File([blob], getOrientationOutputFilename(payload.file.name, turned, outputFormat), { type: blob.type }),
      ...oriented,
    };
  }

  // A flow has nobody to drag a rectangle, so a crop block takes the
  // largest centred one of its chosen shape: what the workspace opens on
  // when that ratio is picked and nothing else is touched.
  let source: CanvasImageSource = image;
  if (step.toolSlug === 'crop-image') {
    const rectangle = getCenteredCrop(sourceDimensions, getCropAspectRatio(step.ratio ?? defaultFlowCropAspectRatio));
    source = adapters.crop(image, rectangle);
    dimensions = { width: rectangle.width, height: rectangle.height };
  }

  const blob = await adapters.encode(source, dimensions, outputFormat, step.toolSlug === 'compress-image' ? (step.quality ?? 80) / 100 : undefined);
  const filename = step.toolSlug === 'remove-image-metadata'
    ? getCleanedImageFilename(payload.file.name, outputFormat)
    : step.toolSlug === 'convert-image'
    ? getConversionOutputFilename(payload.file.name, outputFormat)
    : step.toolSlug === 'resize-image'
      ? getResizeOutputFilename(payload.file.name, outputFormat)
      : step.toolSlug === 'crop-image'
        ? getCropOutputFilename(payload.file.name, outputFormat)
        : getOutputFilename(payload.file.name, outputFormat);

  return { file: new File([blob], filename, { type: blob.type }), ...dimensions };
}
