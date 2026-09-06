import { describe, expect, it } from 'vitest';

import {
  describeCleanedPdf,
  describePdfMetadata,
  emptyPdfMetadata,
  formatPdfDate,
  getCleanPdfOpenErrorMessage,
  getCleanPdfSourceErrorMessage,
  getCleanPdfWriteErrorMessage,
  getCleanedPdfFilename,
  getPopulatedPdfMetadataGroups,
  hasPdfAuthorshipMetadata,
  hasRemovablePdfMetadata,
  maximumCleanPdfPages,
  namedPdfMetadataKeys,
  pdfMetadataScopeNotice,
  readPdfMetadata,
  validateCleanPdfPageCount,
  validateCleanPdfSelection,
  type PdfRawMetadataEntry,
} from '../../src/data/pdf-metadata';

const raw = (entries: readonly PdfRawMetadataEntry[], hasXmp = false) => ({ entries, hasXmp });

const full = raw([
  { key: 'Producer', value: 'Acrobat Distiller 23' },
  { key: 'ModDate', value: "D:20240220081500+02'00'" },
  { key: 'Creator', value: 'Microsoft Word' },
  { key: 'CreationDate', value: 'D:20240115103000Z' },
  { key: 'Title', value: 'Quarterly report' },
  { key: 'Author', value: 'Ada Lovelace' },
  { key: 'Subject', value: 'Numbers' },
  { key: 'Keywords', value: 'one two' },
  { key: 'Company', value: 'Analytical Engines' },
]);

describe('reading what a document says about itself', () => {
  it('names the standard fields in the order a reader shows them', () => {
    const metadata = readPdfMetadata(full);

    expect(metadata.fields.map((field) => field.label)).toEqual([
      'Author',
      'Title',
      'Subject',
      'Keywords',
      'Created',
      'Modified',
      'Written in',
      'Made into a PDF by',
    ]);
    expect(metadata.fields[0]).toEqual({
      label: 'Author',
      value: 'Ada Lovelace',
      group: 'authorship',
    });
  });

  it('counts what it cannot name rather than pretending it is not there', () => {
    const metadata = readPdfMetadata(full);

    expect(metadata.unnamedCount).toBe(1);
    expect(metadata.containers).toEqual(['the document information']);
    expect(describePdfMetadata(metadata)).toBe(
      '8 named fields and 1 more entry in the document information.',
    );
  });

  it('says when the same thing is recorded twice', () => {
    const metadata = readPdfMetadata(raw([{ key: 'Author', value: 'Ada' }], true));

    expect(metadata.containers).toEqual(['the document information', 'an XMP packet']);
    expect(describePdfMetadata(metadata)).toBe(
      '1 named field in the document information and an XMP packet.',
    );
  });

  it('treats an empty field as no field, because it tells nobody anything', () => {
    const metadata = readPdfMetadata(raw([
      { key: 'Author', value: '   ' },
      { key: 'Title', value: '' },
      { key: 'Custom', value: ' ' },
    ]));

    expect(metadata.fields).toEqual([]);
    expect(metadata.unnamedCount).toBe(0);
    expect(hasRemovablePdfMetadata(metadata)).toBe(false);
    expect(describePdfMetadata(metadata)).toMatch(/nothing here to clear/);
  });

  it('collapses a value written across several lines onto one', () => {
    const metadata = readPdfMetadata(raw([{ key: 'Keywords', value: 'one,\n  two,\ttwo' }]));

    expect(metadata.fields[0].value).toBe('one, two, two');
  });

  it('reports an XMP packet even when the information dictionary is empty', () => {
    const metadata = readPdfMetadata(raw([], true));

    expect(metadata.fields).toEqual([]);
    expect(hasRemovablePdfMetadata(metadata)).toBe(true);
    expect(metadata.containers).toEqual(['an XMP packet']);
  });

  it('leads with whether anything names a person', () => {
    expect(hasPdfAuthorshipMetadata(readPdfMetadata(full))).toBe(true);
    expect(hasPdfAuthorshipMetadata(readPdfMetadata(raw([{ key: 'Title', value: 'Report' }])))).toBe(
      false,
    );
    expect(hasRemovablePdfMetadata(emptyPdfMetadata)).toBe(false);
  });

  it('groups the fields, and draws no heading for a group with nothing in it', () => {
    const groups = getPopulatedPdfMetadataGroups(
      readPdfMetadata(raw([
        { key: 'Title', value: 'Report' },
        { key: 'Producer', value: 'Acrobat' },
      ])),
    );

    expect(groups.map((entry) => entry.group)).toEqual(['description', 'software']);
    expect(groups[0].fields.map((field) => field.label)).toEqual(['Title']);
  });

  it('names every key it claims to name', () => {
    expect(namedPdfMetadataKeys).toContain('Author');
    expect(namedPdfMetadataKeys).toContain('Producer');
    expect(namedPdfMetadataKeys).toHaveLength(8);
  });
});

describe('formatPdfDate', () => {
  it('reads a full date as the document recorded it, offset and all', () => {
    expect(formatPdfDate("D:20240220081500+02'00'")).toBe('20 February 2024 at 08:15 UTC+02:00');
    expect(formatPdfDate('D:20240115103000Z')).toBe('15 January 2024 at 10:30 UTC');
    expect(formatPdfDate("D:19991231235959-05'30'")).toBe('31 December 1999 at 23:59 UTC-05:30');
  });

  it('does not shift it into the reader’s own time zone', () => {
    // 23:30 in Tokyo is the previous day in London, and the document said Tokyo.
    expect(formatPdfDate("D:20240115233000+09'00'")).toMatch(/^15 January 2024 at 23:30/);
  });

  it('reads a date that stops early', () => {
    expect(formatPdfDate('D:2024')).toBe('2024');
    expect(formatPdfDate('D:202403')).toBe('March 2024');
    expect(formatPdfDate('D:20240304')).toBe('4 March 2024');
  });

  it('hands back anything it cannot read rather than showing nothing', () => {
    expect(formatPdfDate('sometime last year')).toBe('sometime last year');
    expect(formatPdfDate('D:20241799120000')).toBe('D:20241799120000');
  });
});

describe('refusals and wording', () => {
  it('takes one PDF, and says what anything else is', () => {
    expect(validateCleanPdfSelection([])).toMatch(/Choose a PDF/);
    expect(
      validateCleanPdfSelection([
        { name: 'a.pdf', type: 'application/pdf' },
        { name: 'b.pdf', type: 'application/pdf' },
      ]),
    ).toMatch(/one PDF at a time/);
    expect(validateCleanPdfSelection([{ name: 'notes.txt', type: 'text/plain' }])).toMatch(
      /is not a PDF/,
    );
    expect(validateCleanPdfSelection([{ name: 'a.pdf', type: 'application/pdf' }])).toBeUndefined();
  });

  it('keeps the page ceiling the reader keeps', () => {
    expect(validateCleanPdfPageCount(0)).toMatch(/nothing to clean/);
    expect(validateCleanPdfPageCount(maximumCleanPdfPages + 1)).toMatch(
      new RegExp(maximumCleanPdfPages.toLocaleString()),
    );
    expect(validateCleanPdfPageCount(12)).toBeUndefined();
  });

  it('words a document that will not open in its own terms', () => {
    expect(getCleanPdfOpenErrorMessage('PasswordException')).toMatch(/password-protected/);
    expect(getCleanPdfOpenErrorMessage('InvalidPDFException')).toMatch(/not a PDF/);
    expect(getCleanPdfOpenErrorMessage(undefined)).toMatch(/could not be read/);
    expect(getCleanPdfSourceErrorMessage('encrypted')).toMatch(/password-protected/);
    expect(getCleanPdfSourceErrorMessage('empty')).toMatch(/nothing to clean/);
    expect(getCleanPdfSourceErrorMessage('unreadable')).toMatch(/could not be read as a PDF/);
    expect(getCleanPdfWriteErrorMessage()).toMatch(/original is untouched/);
  });

  it('says the pages are untouched, and never claims more than it does', () => {
    expect(describeCleanedPdf(4)).toBe('Metadata cleared · 4 pages kept exactly as they were');
    expect(pdfMetadataScopeNotice).toMatch(/does not touch what is on the pages/);
  });

  it('names the file for what happened to it', () => {
    expect(getCleanedPdfFilename('report.pdf')).toBe('report-clean.pdf');
    expect(getCleanedPdfFilename('')).toBe('document-clean.pdf');
  });
});
