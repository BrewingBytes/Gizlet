import { getInputImageFormat, getFormatLabel, type ImageInputFormat, type ImageOutputFormat } from './image-compression';

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

const inputFormatLabels: Record<ImageInputFormat, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/bmp': 'BMP',
};

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Returns the detected source format from a browser File-like object. */
export function getSourceFormat(file: FileDetails): ImageInputFormat | undefined {
  return getInputImageFormat(file);
}

export function getSourceFormatLabel(format: ImageInputFormat): string {
  return inputFormatLabels[format];
}

export function getConversionOutputFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';

  return `${basename}-converted.${outputExtensions[format]}`;
}

export function getOutputFormatLabel(format: ImageOutputFormat): string {
  return getFormatLabel(format);
}

/** JPEG has no alpha channel, so transparent source pixels would be flattened. */
export function losesTransparency(sourceHasTransparency: boolean, outputFormat: string): boolean {
  return sourceHasTransparency && outputFormat === 'image/jpeg';
}
