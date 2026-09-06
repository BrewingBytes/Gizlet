import { describe, expect, it } from 'vitest';

import {
  describeDroppedFile,
  describeDroppedFileDestinations,
  getDroppedFileCountMessage,
  getDroppedFileKind,
  getGizletsForDroppedFile,
  getUnsupportedDroppedFileMessage,
} from '../../src/data/file-drop';
import { getFlowToolsForInput, flowlessToolSlugs } from '../../src/data/tool-flows';
import { getAvailableTools } from '../../src/data/tools';

const file = (name: string, type: string) => ({ name, type });

describe('what the file says it is', () => {
  it('reads a picture and a document from the name and the type', () => {
    expect(getDroppedFileKind(file('holiday.jpg', 'image/jpeg'))).toBe('image-file');
    expect(getDroppedFileKind(file('scan.PNG', ''))).toBe('image-file');
    expect(getDroppedFileKind(file('report.pdf', 'application/pdf'))).toBe('pdf-file');
    expect(getDroppedFileKind(file('report.PDF', ''))).toBe('pdf-file');
  });

  it('says nothing about a file these Gizlets do not read', () => {
    expect(getDroppedFileKind(file('notes.txt', 'text/plain'))).toBeUndefined();
    expect(getDroppedFileKind(file('archive.zip', 'application/zip'))).toBeUndefined();
    expect(getDroppedFileKind(file('clip.mp4', 'video/mp4'))).toBeUndefined();
  });
});

describe('where a dropped file can go', () => {
  it('offers every Gizlet whose contract reads that payload', () => {
    const offered = getGizletsForDroppedFile('image-file').map((tool) => tool.slug);

    for (const tool of getFlowToolsForInput('image-file')) {
      expect(offered).toContain(tool.toolSlug);
    }
  });

  it('offers the Gizlets that declare no contract on the payload they are about', () => {
    const images = getGizletsForDroppedFile('image-file').map((tool) => tool.slug);
    const documents = getGizletsForDroppedFile('pdf-file').map((tool) => tool.slug);

    // A viewer reads a file and hands nothing on, which is why it has no flow
    // contract — and why leaving it out of this list would be wrong.
    expect(documents).toContain('pdf-viewer');
    expect(images).toContain('image-dimensions');
    expect(images).toContain('image-color-picker');
  });

  it('never offers a Gizlet that does not exist yet, or one for the other payload', () => {
    const published = new Set<string>(getAvailableTools().map((tool) => tool.slug));

    for (const kind of ['image-file', 'pdf-file'] as const) {
      for (const tool of getGizletsForDroppedFile(kind)) {
        expect(published.has(tool.slug)).toBe(true);
      }
    }

    const images = getGizletsForDroppedFile('image-file').map((tool) => tool.slug);
    const documents = getGizletsForDroppedFile('pdf-file').map((tool) => tool.slug);

    expect(images).not.toContain('pdf-viewer');
    expect(documents).not.toContain('compress-image');
    // A text Gizlet belongs to neither: its category is about no file payload.
    expect([...images, ...documents]).not.toContain('json-formatter');
  });

  it('keeps registry order, so the list reads the way every other list does', () => {
    const offered = getGizletsForDroppedFile('image-file');

    expect(offered.map((tool) => tool.id)).toEqual([...offered.map((tool) => tool.id)].sort((left, right) => left - right));
  });

  it('leaves nothing published and readable out of both lists', () => {
    const flowless = new Set<string>(flowlessToolSlugs);
    const offered = new Set([
      ...getGizletsForDroppedFile('image-file').map((tool) => tool.slug),
      ...getGizletsForDroppedFile('pdf-file').map((tool) => tool.slug),
    ]);

    for (const tool of getAvailableTools()) {
      if (tool.category !== 'images' && tool.category !== 'pdf') continue;
      // Every published image or PDF Gizlet reads a file of its own kind,
      // whether it declares a contract or deliberately declares none.
      expect(offered.has(tool.slug), tool.slug).toBe(true);
      expect(flowless.has(tool.slug) || !flowless.has(tool.slug)).toBe(true);
    }
  });
});

describe('what the panel says', () => {
  const formatSize = (bytes: number) => `${bytes} B`;

  it('describes the file it is holding', () => {
    expect(describeDroppedFile({ name: 'holiday.jpg', size: 2048 }, 'image-file', formatSize)).toBe(
      'holiday.jpg · an image · 2048 B',
    );
    expect(
      describeDroppedFile({ name: 'holiday.jpg', size: 2048 }, 'image-file', formatSize, {
        width: 800,
        height: 600,
      }),
    ).toBe('holiday.jpg · an image · 2048 B · 800 × 600 px');
  });

  it('counts the destinations the way a sentence does', () => {
    expect(describeDroppedFileDestinations('image-file', 1)).toBe('1 Gizlet takes an image.');
    expect(describeDroppedFileDestinations('pdf-file', 6)).toBe('6 Gizlets take a PDF.');
    expect(describeDroppedFileDestinations('pdf-file', 0)).toMatch(/Nothing published reads a PDF/);
  });

  it('says what to do about a file it cannot start from', () => {
    expect(getUnsupportedDroppedFileMessage('archive.zip')).toMatch(/^archive\.zip is not an image or a PDF/);
    expect(getUnsupportedDroppedFileMessage('archive.zip')).toMatch(/Search above/);
    expect(getDroppedFileCountMessage()).toMatch(/one file at a time/);
  });
});
