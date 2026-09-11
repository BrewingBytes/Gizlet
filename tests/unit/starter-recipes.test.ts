import { describe, expect, it } from 'vitest';

import { decodeRecipe } from '../../src/data/recipes';
import { getStarterRecipes } from '../../src/data/starter-recipes';
import {
  getFlowCategory,
  getFlowOutputKind,
  isValidFlowSequence,
} from '../../src/data/tool-flows';
import { toolRegistry } from '../../src/data/tools';

const recipes = getStarterRecipes();
const fragmentOf = (href: string) => href.slice(href.indexOf('#'));

describe('getStarterRecipes', () => {
  it('publishes the three curated recipes, each with a stable id', () => {
    expect(recipes.map((recipe) => recipe.id)).toEqual([
      'web-ready-image',
      'photos-to-document',
      'combine-documents',
    ]);
  });

  it('links every card at the flow builder, carrying its settings in the fragment', () => {
    for (const recipe of recipes) {
      expect(recipe.href.startsWith('/flows/#')).toBe(true);
    }

    // The exact links, so a change to a recipe's settings is a change a review
    // can see rather than one that only moves a number inside an opaque string.
    expect(recipes.map((recipe) => fragmentOf(recipe.href))).toEqual([
      '#r=v1;f=webp;crop-image:a=16x9;resize-image:w=1600,h=900',
      '#r=v1;f=jpeg;compress-image:q=80;jpg-to-pdf:p=a4,o=portrait',
      '#r=v1;c=pdf;merge-pdf;clean-pdf-metadata',
    ]);
  });

  it('round-trips every recipe through the shared encoder and decoder', () => {
    for (const recipe of recipes) {
      const decoded = decodeRecipe(fragmentOf(recipe.href));

      expect(decoded).toBeDefined();
      // The decoded chain is the chain the card describes, in the same order.
      expect(decoded?.steps.map((step) => step.toolSlug)).toEqual(
        recipe.steps.map((step) => step.toolSlug),
      );
    }
  });

  it('passes sequence validation against the compatibility graph', () => {
    for (const recipe of recipes) {
      const decoded = decodeRecipe(fragmentOf(recipe.href));
      const category = getFlowCategory(decoded!.category!);
      const toolSlugs = decoded!.steps.map((step) => step.toolSlug);

      expect(isValidFlowSequence(category.input, toolSlugs)).toBe(true);
      expect(getFlowOutputKind(category.input, toolSlugs)).toBeDefined();
    }
  });

  it('names every block from the tool registry rather than from its own copy', () => {
    for (const recipe of recipes) {
      for (const step of recipe.steps) {
        const tool = toolRegistry.find((candidate) => candidate.slug === step.toolSlug);

        expect(tool).toBeDefined();
        expect(step.name).toBe(tool?.name);
        // Every block a card advertises is one that exists, not one the
        // roadmap has only promised.
        expect(tool?.launchStatus).toBe('available');
      }
    }
  });

  it('says what each recipe takes and what it gives back', () => {
    expect(recipes.map((recipe) => [recipe.input, recipe.output])).toEqual([
      ['One image', 'One WebP image'],
      ['Several images', 'One PDF'],
      ['Several PDFs', 'One PDF'],
    ]);
  });

  it('names the image format control the builder would show, and only then', () => {
    expect(recipes.map((recipe) => recipe.format)).toEqual([
      { label: 'Final output format', value: 'WebP' },
      { label: 'Page image format', value: 'JPEG' },
      // A merge and a metadata clear re-encode no image, so the builder shows
      // no format control and the card claims none.
      undefined,
    ]);
  });

  it('describes the effect of every setting the recipe carries', () => {
    for (const recipe of recipes) {
      expect(recipe.steps.length).toBeGreaterThan(0);

      for (const step of recipe.steps) {
        expect(step.effect.length).toBeGreaterThan(0);
      }
    }

    // The two recipes whose brief asked for a setting no link can carry say so
    // rather than shipping a different flow quietly.
    expect(recipes[0].substitution).toContain('longest side');
    expect(recipes[1].substitution).toContain('longest side');
  });

  it('says plainly that clearing a PDF’s fields is not redaction', () => {
    const combining = recipes.find((recipe) => recipe.id === 'combine-documents');

    expect(combining?.limit).toContain('not redaction');
    // Borrowed from the Gizlet that owns the claim, so the two cannot disagree.
    expect(combining?.limit).toContain('does not touch what is on the pages');
  });
});
