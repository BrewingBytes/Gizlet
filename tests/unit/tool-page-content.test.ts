import { describe, expect, it } from 'vitest';

import {
  getContentSectionId,
  getToolContentSections,
  getToolPageContent,
} from '../../src/data/tool-page-content';
import { getAvailableTools, toolRegistry } from '../../src/data/tools';

const availableTools = getAvailableTools();

function contentFor(slug: string) {
  const tool = toolRegistry.find((candidate) => candidate.slug === slug)!;
  const content = getToolPageContent(tool);

  expect(content, slug).toBeDefined();

  return content!;
}

/** Every sentence a Gizlet page publishes from its content entry. */
function allProse(slug: string): readonly string[] {
  const content = contentFor(slug);

  return [
    ...getToolContentSections(content).flatMap((section) => [
      ...section.paragraphs,
      ...(section.details ?? []).map((detail) => detail.description),
    ]),
    ...content.faq.map((entry) => entry.answer),
  ];
}

describe('getToolPageContent', () => {
  it('covers every available Gizlet', () => {
    for (const tool of availableTools) {
      expect(getToolPageContent(tool), tool.slug).toBeDefined();
    }
  });

  it('gives each Gizlet four sections that say something', () => {
    for (const tool of availableTools) {
      const sections = getToolContentSections(getToolPageContent(tool)!);

      expect(sections, tool.slug).toHaveLength(4);

      for (const section of sections) {
        expect(section.heading.trim(), tool.slug).not.toBe('');
        expect(
          section.paragraphs.length + (section.details?.length ?? 0),
          `${tool.slug}: ${section.heading}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('gives each Gizlet at least four questions', () => {
    for (const tool of availableTools) {
      const { faq } = getToolPageContent(tool)!;

      expect(faq.length, tool.slug).toBeGreaterThanOrEqual(4);

      for (const entry of faq) {
        expect(entry.question.trim().endsWith('?'), `${tool.slug}: ${entry.question}`).toBe(true);
        expect(entry.answer.trim().length, `${tool.slug}: ${entry.question}`).toBeGreaterThan(40);
      }
    }
  });

  it('writes for each Gizlet rather than repeating boilerplate across pages', () => {
    const headings = availableTools.flatMap((tool) =>
      getToolContentSections(getToolPageContent(tool)!).map((section) => section.heading),
    );
    const questions = availableTools.flatMap((tool) =>
      getToolPageContent(tool)!.faq.map((entry) => entry.question),
    );
    const prose = availableTools.flatMap((tool) => allProse(tool.slug));

    expect(new Set(headings)).toHaveLength(headings.length);
    expect(new Set(questions)).toHaveLength(questions.length);
    expect(new Set(prose)).toHaveLength(prose.length);
  });

  it('never claims more privacy than the registry does', () => {
    const localClaims = [
      'nothing to upload',
      'no upload',
      'never sent',
      'stays on this device',
      'not sent anywhere',
      'never uploaded',
    ];

    for (const tool of availableTools) {
      const content = getToolPageContent(tool)!;
      const text = [content.privacy.heading, ...allProse(tool.slug)].join(' ').toLowerCase();
      const claimsLocal = localClaims.some((claim) => text.includes(claim));

      expect(claimsLocal, tool.slug).toBe(tool.processesLocally);
    }
  });

  it('describes the processing where the registry says it happens', () => {
    for (const tool of availableTools.filter((candidate) => candidate.processesLocally)) {
      const { privacy } = getToolPageContent(tool)!;
      const text = privacy.paragraphs.join(' ').toLowerCase();

      expect(text, tool.slug).toMatch(/this browser|this device|this page/);
    }
  });
});

describe('getContentSectionId', () => {
  it('derives a stable id from a section heading', () => {
    expect(getContentSectionId({ heading: 'What the format and quality controls do', paragraphs: [] })).toBe(
      'about-what-the-format-and-quality-controls-do',
    );
    expect(getContentSectionId({ heading: 'No upload, no queue!', paragraphs: [] })).toBe(
      'about-no-upload-no-queue',
    );
  });

  it('gives every section on a page a unique id', () => {
    for (const tool of availableTools) {
      const ids = getToolContentSections(getToolPageContent(tool)!).map(getContentSectionId);

      expect(new Set(ids), tool.slug).toHaveLength(ids.length);
    }
  });
});
