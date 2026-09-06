import { describePdfPageCount } from './jpg-to-pdf';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';

/**
 * What a document says about where it came from, and what to call it.
 *
 * A PDF carries an information dictionary — the fields a reader shows under
 * File properties — and usually an XMP packet saying much the same thing again.
 * Between them they name the person who wrote it, the machine that made it, the
 * program it was written in and when, and none of that is visible on the page.
 * A CV keeps the name of whoever's template it started from; a scan keeps the
 * model of the scanner; a document exported from a work laptop keeps the
 * software licensed to a company.
 *
 * This module is the part of the Gizlet that decides what those fields mean and
 * how they read. Everything here is a pure function over plain data: the values
 * are pulled out of the document by `scripts/pdf-generation` and handed here as
 * strings, so what a visitor is told can be tested exhaustively without a PDF.
 *
 * Nothing here reaches into the pages. The issue is explicit about it and so is
 * the page: this clears the document's own fields, and text hidden on a page,
 * an attachment, or something behind a black rectangle is a different problem
 * with a different answer.
 */

/** What a field is about, which is what decides how alarming it is. */
export type PdfMetadataGroup = 'authorship' | 'description' | 'time' | 'software' | 'other';

export const pdfMetadataGroupLabels = {
  authorship: 'Who it belongs to',
  description: 'What it says it is',
  time: 'When it was made',
  software: 'What made it',
  other: 'Everything else',
} as const satisfies Record<PdfMetadataGroup, string>;

export const pdfMetadataGroupOrder = [
  'authorship',
  'description',
  'time',
  'software',
  'other',
] as const satisfies readonly PdfMetadataGroup[];

export interface PdfMetadataField {
  readonly label: string;
  readonly value: string;
  readonly group: PdfMetadataGroup;
}

/**
 * The keys of the information dictionary, in the order a reader shows them.
 *
 * These are the standard ones. A writer may put anything else in there too —
 * `SourceModified`, `Company`, a licence string — and those are counted rather
 * than named, so the summary never implies the document carries less than it
 * does.
 */
const namedKeys = [
  { key: 'Author', label: 'Author', group: 'authorship' },
  { key: 'Title', label: 'Title', group: 'description' },
  { key: 'Subject', label: 'Subject', group: 'description' },
  { key: 'Keywords', label: 'Keywords', group: 'description' },
  { key: 'CreationDate', label: 'Created', group: 'time' },
  { key: 'ModDate', label: 'Modified', group: 'time' },
  { key: 'Creator', label: 'Written in', group: 'software' },
  { key: 'Producer', label: 'Made into a PDF by', group: 'software' },
] as const satisfies readonly {
  key: string;
  label: string;
  group: PdfMetadataGroup;
}[];

/** The keys this Gizlet names, for the writer that has to clear them. */
export const namedPdfMetadataKeys: readonly string[] = namedKeys.map((entry) => entry.key);

/** One entry of the information dictionary, as it was found in the document. */
export interface PdfRawMetadataEntry {
  readonly key: string;
  readonly value: string;
}

export interface PdfRawMetadata {
  readonly entries: readonly PdfRawMetadataEntry[];
  /** Whether the document also carries an XMP packet saying it again. */
  readonly hasXmp: boolean;
}

export const emptyPdfRawMetadata: PdfRawMetadata = { entries: [], hasXmp: false };

export interface PdfMetadata {
  /** The fields this Gizlet can name, in the order a reader shows them. */
  readonly fields: readonly PdfMetadataField[];
  /**
   * Entries found and not named. They are cleared too; counting them is what
   * keeps the summary from implying the document carries only what is listed.
   */
  readonly unnamedCount: number;
  /** Where the metadata was found, for the line that says so. */
  readonly containers: readonly string[];
}

export const emptyPdfMetadata: PdfMetadata = { fields: [], unnamedCount: 0, containers: [] };

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * A PDF date, as a person reads one.
 *
 * The format is `D:YYYYMMDDHHmmSSOHH'mm'`, and every part after the year is
 * optional. It is deliberately not turned into a `Date`: a date is shown here
 * as the document recorded it, offset and all, rather than shifted into the
 * reader's own time zone, because "when was this written" is a fact about the
 * document and not about whoever is looking at it. That also makes this
 * testable without a machine's clock or locale in the way.
 *
 * Anything that does not parse is returned as it was found. A field showing
 * something odd is a truer answer than a field showing nothing.
 */
export function formatPdfDate(value: string): string {
  const match = /^D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:(Z)|([+-])(\d{2})'?(\d{2})?)?/.exec(
    value.trim(),
  );

  if (!match) return value.trim();

  const [, year, month, day, hour, minute, , zulu, sign, offsetHours, offsetMinutes] = match;
  const monthIndex = month ? Number(month) - 1 : undefined;
  const monthName = monthIndex !== undefined ? monthNames[monthIndex] : undefined;

  if (monthIndex !== undefined && !monthName) return value.trim();

  const date = [day ? String(Number(day)) : undefined, monthName, year].filter(Boolean).join(' ');
  const time = hour ? ` at ${hour}:${minute ?? '00'}` : '';
  const zone = zulu ? ' UTC' : sign ? ` UTC${sign}${offsetHours}:${offsetMinutes ?? '00'}` : '';

  return `${date}${time}${zone}`;
}

/** Collapses the whitespace a field arrived with, so a value reads as one line. */
function normaliseValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * What the document is carrying, named and counted.
 *
 * An empty value is not a field: a writer that puts `/Author ()` in every file
 * it makes has told nobody anything, and listing it would make the summary
 * alarming about nothing.
 */
export function readPdfMetadata(raw: PdfRawMetadata): PdfMetadata {
  const fields: PdfMetadataField[] = [];
  let unnamedCount = 0;

  for (const named of namedKeys) {
    const entry = raw.entries.find((candidate) => candidate.key === named.key);
    const value = entry ? normaliseValue(entry.value) : '';

    if (value === '') continue;

    fields.push({
      label: named.label,
      value: named.group === 'time' ? formatPdfDate(value) : value,
      group: named.group,
    });
  }

  for (const entry of raw.entries) {
    if (namedPdfMetadataKeys.includes(entry.key)) continue;
    if (normaliseValue(entry.value) === '') continue;

    unnamedCount += 1;
  }

  const containers: string[] = [];

  if (fields.length > 0 || unnamedCount > 0) containers.push('the document information');
  if (raw.hasXmp) containers.push('an XMP packet');

  return { fields, unnamedCount, containers };
}

export function hasRemovablePdfMetadata(metadata: PdfMetadata): boolean {
  return metadata.fields.length > 0 || metadata.unnamedCount > 0 || metadata.containers.length > 0;
}

/** Whether anything names a person, which is the part worth leading with. */
export function hasPdfAuthorshipMetadata(metadata: PdfMetadata): boolean {
  return metadata.fields.some((field) => field.group === 'authorship');
}

export function getPdfMetadataGroup(
  metadata: PdfMetadata,
  group: PdfMetadataGroup,
): readonly PdfMetadataField[] {
  return metadata.fields.filter((field) => field.group === group);
}

/** The groups with something in them, so an empty heading is never drawn. */
export function getPopulatedPdfMetadataGroups(
  metadata: PdfMetadata,
): readonly { readonly group: PdfMetadataGroup; readonly fields: readonly PdfMetadataField[] }[] {
  return pdfMetadataGroupOrder
    .map((group) => ({ group, fields: getPdfMetadataGroup(metadata, group) }))
    .filter((entry) => entry.fields.length > 0);
}

/** The one line that says what was found, before anything is cleared. */
export function describePdfMetadata(metadata: PdfMetadata): string {
  if (!hasRemovablePdfMetadata(metadata)) {
    return 'This PDF carries no document metadata. There is nothing here to clear.';
  }

  const named = metadata.fields.length;
  const parts: string[] = [];

  if (named > 0) parts.push(`${named} named ${named === 1 ? 'field' : 'fields'}`);
  if (metadata.unnamedCount > 0) {
    parts.push(`${metadata.unnamedCount} more ${metadata.unnamedCount === 1 ? 'entry' : 'entries'}`);
  }

  const found = parts.length > 0 ? parts.join(' and ') : 'metadata';
  const where = metadata.containers.join(' and ');

  return `${found} in ${where}.`;
}

/** What the result panel says, which has to be about the pages as well. */
export function describeCleanedPdf(pageCount: number): string {
  return `Metadata cleared · ${describePdfPageCount(pageCount)} kept exactly as they were`;
}

export function getCleanedPdfFilename(inputName: string): string {
  return `${inputName.replace(/\.[^.]+$/, '') || 'document'}-clean.pdf`;
}

/** The ceiling the reader keeps, so a document that opens can be cleaned. */
export const maximumCleanPdfPages = maximumPdfViewerPages;

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

export function validateCleanPdfSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) return 'Choose a PDF to read.';
  if (files.length > 1) return 'This Gizlet reads one PDF at a time. Choose a single file.';
  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

export function validateCleanPdfPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF reports no pages, so there is nothing to clean.';
  }

  if (pageCount > maximumCleanPdfPages) {
    return `This Gizlet cleans up to ${maximumCleanPdfPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}.`;
  }

  return undefined;
}

export function getCleanPdfOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so its fields cannot be read. Open it in an app that can ask for the password, save an unlocked copy, and clean that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read. It may be damaged, or renamed from another format.';
  }

  return 'This PDF could not be opened, so its metadata could not be read.';
}

/** Wording for a document pdf-lib will not read or rewrite. */
export function getCleanPdfSourceErrorMessage(
  reason: 'encrypted' | 'empty' | 'unreadable',
): string {
  if (reason === 'encrypted') {
    return 'This PDF is password-protected, so its fields cannot be read or cleared. Open it in an app that can ask for the password, save an unlocked copy, and clean that.';
  }

  if (reason === 'empty') return 'This PDF has no pages, so there is nothing to clean.';

  return 'This file could not be read as a PDF. It may be damaged, or renamed from another format.';
}

export function getCleanPdfWriteErrorMessage(): string {
  return 'The cleaned copy could not be written on this device. Nothing was changed, and your original is untouched.';
}

/**
 * The sentence the Gizlet must not drop.
 *
 * It clears the document's own fields. Text under a black rectangle, an
 * attachment, or a name in the page content itself are all still there, and a
 * Gizlet that let anyone believe otherwise would be worse than no Gizlet.
 */
export const pdfMetadataScopeNotice =
  'This clears the document’s own fields. It does not touch what is on the pages: text hidden under a shape, an attachment, or a name written in the document itself all stay exactly where they are.';
