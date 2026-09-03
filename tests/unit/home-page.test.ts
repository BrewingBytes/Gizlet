import { describe, expect, it } from 'vitest';

import {
  homePageDescription,
  homePageLocalProcessingClaims,
  homePageTitle,
} from '../../src/data/home-page';
import { getAvailableTools } from '../../src/data/tools';

/** Words too common to count as a shared phrase between two sentences. */
const stopWords = new Set([
  'a', 'an', 'and', 'or', 'the', 'in', 'on', 'of', 'to', 'no', 'your', 'each', 'does', 'is', 'it',
]);

function significantWords(sentence: string): readonly string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !stopWords.has(word));
}

/** Consecutive significant-word pairs, which is what reads as a lifted phrase. */
function phrases(sentence: string): readonly string[] {
  const words = significantWords(sentence);

  return words.slice(1).map((word, index) => `${words[index]} ${word}`);
}

describe('the home page title and description', () => {
  it('shares no phrase between them, so the description is not a repeat of the title', () => {
    const titlePhrases = new Set(phrases(homePageTitle));
    const shared = phrases(homePageDescription).filter((phrase) => titlePhrases.has(phrase));

    // A description that restates its title is discarded by search engines,
    // which then assemble a worse snippet out of the page's visible text.
    expect(shared).toEqual([]);
  });

  it('says what the Gizlets do rather than only what the site is like', () => {
    // Naming real jobs is the whole reason the snippet is worth having.
    expect(homePageDescription).toMatch(/compress|resize|format|pdf/i);
  });

  it('fits the length a search result will actually show', () => {
    expect(homePageDescription.length).toBeGreaterThan(70);
    expect(homePageDescription.length).toBeLessThanOrEqual(160);
  });

  it('keeps its title within the length a result will show', () => {
    expect(homePageTitle.length).toBeLessThanOrEqual(60);
  });
});

describe('the home page’s local-processing claim', () => {
  it('still makes every claim the list says it makes', () => {
    for (const claim of homePageLocalProcessingClaims) {
      expect(homePageDescription.toLowerCase(), claim).toContain(claim);
    }
  });

  it('is only allowed while every published Gizlet actually processes on-device', () => {
    const claimsLocal = homePageLocalProcessingClaims.some((claim) =>
      homePageDescription.toLowerCase().includes(claim),
    );

    expect(claimsLocal).toBe(true);
    // The registry is the authority. Publish a Gizlet that uses a remote
    // service and this fails until the home page stops promising otherwise.
    expect(getAvailableTools().every((tool) => tool.processesLocally)).toBe(true);
  });
});
