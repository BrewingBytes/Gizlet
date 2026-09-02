import { describe, expect, it } from 'vitest';

import {
  getGizletRequestIssueUrl,
  gizletRequestRepositoryUrl,
  validateGizletRequest,
} from '../../src/data/gizlet-request';

describe('Gizlet request validation', () => {
  it('requires a useful tool idea before preparing a request', () => {
    expect(validateGizletRequest({ toolIdea: '  ', useCase: '', contact: '' })).toEqual({
      toolIdea: 'Tell us the Gizlet you would like us to make.',
    });
    expect(validateGizletRequest({ toolIdea: 'AI', useCase: '', contact: '' })).toEqual({
      toolIdea: 'Use at least three characters so we can understand the idea.',
    });
  });

  it('accepts an idea with optional context and contact omitted', () => {
    expect(validateGizletRequest({ toolIdea: 'PDF page remover', useCase: '', contact: '' })).toEqual({});
  });
});

describe('GitHub issue handoff', () => {
  it('makes a pre-filled issue URL without changing the submitted request text', () => {
    const url = new URL(
      getGizletRequestIssueUrl({
        toolIdea: '  Remove blank PDF pages  ',
        useCase: 'I scan contracts every week.',
        contact: 'hello@example.com',
      }),
    );

    expect(gizletRequestRepositoryUrl).toBe('https://github.com/BrewingBytes/Gizlet');
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe('/BrewingBytes/Gizlet/issues/new');
    expect(url.searchParams.get('title')).toBe('Gizlet request: Remove blank PDF pages');
    expect(url.searchParams.get('body')).toContain('I scan contracts every week.');
    expect(url.searchParams.get('body')).toContain('hello@example.com');
  });
});
