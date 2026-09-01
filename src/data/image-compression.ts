export const imageOutputFormats = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageOutputFormat = (typeof imageOutputFormats)[number];

export const imageInputFormats = [
  ...imageOutputFormats,
  'image/avif',
  'image/bmp',
] as const;

export type ImageInputFormat = (typeof imageInputFormats)[number];

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

const formatDetails: Record<ImageOutputFormat, { readonly extension: string; readonly label: string }> = {
  'image/jpeg': { extension: 'jpg', label: 'JPEG' },
  'image/png': { extension: 'png', label: 'PNG' },
  'image/webp': { extension: 'webp', label: 'WebP' },
};

export function isImageOutputFormat(format: string): format is ImageOutputFormat {
  return imageOutputFormats.includes(format as ImageOutputFormat);
}

export function isSupportedImageFile(file: FileDetails): boolean {
  if (isImageInputFormat(file.type)) {
    return true;
  }

  return /\.(jpe?g|png|webp|avif|bmp)$/i.test(file.name);
}

export function isImageInputFormat(format: string): format is ImageInputFormat {
  return imageInputFormats.includes(format as ImageInputFormat);
}

export function getInputImageFormat(file: FileDetails): ImageInputFormat | undefined {
  if (isImageInputFormat(file.type)) {
    return file.type;
  }

  if (/\.jpe?g$/i.test(file.name)) {
    return 'image/jpeg';
  }

  if (/\.png$/i.test(file.name)) {
    return 'image/png';
  }

  if (/\.webp$/i.test(file.name)) {
    return 'image/webp';
  }

  if (/\.avif$/i.test(file.name)) {
    return 'image/avif';
  }

  if (/\.bmp$/i.test(file.name)) {
    return 'image/bmp';
  }

  return undefined;
}

export function getPreferredOutputFormat(inputFormat: ImageInputFormat | undefined): ImageOutputFormat {
  return inputFormat && isImageOutputFormat(inputFormat) ? inputFormat : 'image/webp';
}

export function getOutputFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';

  return `${basename}-compressed.${formatDetails[format].extension}`;
}

export function getFormatLabel(format: ImageOutputFormat): string {
  return formatDetails[format].label;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function formatSizeChange(originalBytes: number, resultBytes: number): string {
  if (originalBytes <= 0) {
    return 'Size comparison unavailable';
  }

  const difference = ((originalBytes - resultBytes) / originalBytes) * 100;
  const roundedDifference = Math.round(Math.abs(difference));

  return difference >= 0 ? `${roundedDifference}% smaller` : `${roundedDifference}% larger`;
}
