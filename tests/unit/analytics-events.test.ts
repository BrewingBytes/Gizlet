import { describe, expect, it } from 'vitest';

import {
  analyticsErrorCategories,
  analyticsEventNames,
  analyticsOutputFormats,
  buildAnalyticsEvent,
} from '../../src/data/analytics-events';
import { maximumRecipeSteps } from '../../src/data/recipes';
import { getAvailableTools, getPlannedTools } from '../../src/data/tools';

const slug = 'compress-image';

describe('buildAnalyticsEvent', () => {
  it('builds every whitelisted event from valid values', () => {
    expect(buildAnalyticsEvent('tool_opened', { tool_slug: slug })).toEqual({
      name: 'tool_opened',
      parameters: { tool_slug: slug },
    });
    expect(buildAnalyticsEvent('tool_completed', { tool_slug: slug })).toEqual({
      name: 'tool_completed',
      parameters: { tool_slug: slug },
    });
    expect(
      buildAnalyticsEvent('tool_error', { tool_slug: slug, error_category: 'processing-failed' }),
    ).toEqual({
      name: 'tool_error',
      parameters: { tool_slug: slug, error_category: 'processing-failed' },
    });
    expect(
      buildAnalyticsEvent('tool_download', { tool_slug: slug, output_format: 'image' }),
    ).toEqual({
      name: 'tool_download',
      parameters: { tool_slug: slug, output_format: 'image' },
    });
    expect(
      buildAnalyticsEvent('flow_step', { from_slug: slug, to_slug: 'convert-image', step_index: 1 }),
    ).toEqual({
      name: 'flow_step',
      parameters: { from_slug: slug, to_slug: 'convert-image', step_index: 1 },
    });
  });

  it('rejects an event it does not define', () => {
    expect(buildAnalyticsEvent('page_view', { tool_slug: slug })).toBeUndefined();
    expect(buildAnalyticsEvent('tool_upload', { tool_slug: slug })).toBeUndefined();
    expect(buildAnalyticsEvent('', {})).toBeUndefined();
    // Prototype keys are not events either.
    expect(buildAnalyticsEvent('toString', {})).toBeUndefined();
    expect(buildAnalyticsEvent('constructor', {})).toBeUndefined();
  });

  it('drops the whole event when an unexpected key rides along', () => {
    expect(
      buildAnalyticsEvent('tool_completed', { tool_slug: slug, file_name: 'holiday.jpg' }),
    ).toBeUndefined();
  });

  it('drops the whole event when an expected key is missing', () => {
    expect(buildAnalyticsEvent('tool_completed', {})).toBeUndefined();
    expect(buildAnalyticsEvent('tool_error', { tool_slug: slug })).toBeUndefined();
    expect(buildAnalyticsEvent('flow_step', { from_slug: slug, to_slug: slug })).toBeUndefined();
  });

  it('refuses anything shaped like a payload, whatever key it is offered under', () => {
    // The contract's central claim: there is no parameter these fit into.
    const payloads: readonly unknown[] = [
      'holiday-photo.jpg',
      '/Users/someone/Pictures/holiday.jpg',
      'image/jpeg',
      2_400_000,
      'correct horse battery staple',
      '{"secret":"value"}',
      'https://example.com/private',
      'Error: failed to read EXIF from holiday.jpg',
      '<script>alert(1)</script>',
    ];

    for (const payload of payloads) {
      expect(buildAnalyticsEvent('tool_completed', { tool_slug: payload })).toBeUndefined();
      expect(
        buildAnalyticsEvent('tool_download', { tool_slug: slug, output_format: payload }),
      ).toBeUndefined();
      expect(
        buildAnalyticsEvent('tool_error', { tool_slug: slug, error_category: payload }),
      ).toBeUndefined();
      expect(
        buildAnalyticsEvent('flow_step', { from_slug: slug, to_slug: slug, step_index: payload }),
      ).toBeUndefined();
    }
  });

  it('accepts only a slug the registry actually publishes', () => {
    for (const tool of getAvailableTools()) {
      expect(buildAnalyticsEvent('tool_opened', { tool_slug: tool.slug })).toBeDefined();
    }

    // A planned Gizlet has no implementation, so it cannot have been used.
    for (const tool of getPlannedTools()) {
      expect(buildAnalyticsEvent('tool_opened', { tool_slug: tool.slug })).toBeUndefined();
    }

    expect(buildAnalyticsEvent('tool_opened', { tool_slug: 'not-a-gizlet' })).toBeUndefined();
  });

  it('bounds the step index rather than passing a number through', () => {
    expect(buildAnalyticsEvent('flow_step', { from_slug: slug, to_slug: slug, step_index: 0 })).toBeDefined();
    for (const value of [-1, 1.5, maximumRecipeSteps, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      expect(
        buildAnalyticsEvent('flow_step', { from_slug: slug, to_slug: slug, step_index: value }),
      ).toBeUndefined();
    }
  });

  it('never returns a parameter it was not asked to validate', () => {
    const event = buildAnalyticsEvent('tool_download', { tool_slug: slug, output_format: 'image' });

    expect(Object.keys(event?.parameters ?? {})).toEqual(['tool_slug', 'output_format']);
  });
});

describe('the whitelist itself', () => {
  it('publishes exactly the events the data contract names', () => {
    expect([...analyticsEventNames].sort()).toEqual([
      'flow_step',
      'tool_completed',
      'tool_download',
      'tool_error',
      'tool_opened',
    ]);
  });

  it('keeps every enum member coarse enough to carry nothing about a file', () => {
    expect(analyticsOutputFormats).toEqual(['image', 'pdf', 'archive', 'text', 'data']);
    expect(analyticsErrorCategories).toEqual([
      'unsupported-input',
      'input-too-large',
      'processing-failed',
      'feature-unavailable',
    ]);
  });
});
