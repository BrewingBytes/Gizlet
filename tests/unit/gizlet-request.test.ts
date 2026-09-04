import { describe, expect, it } from 'vitest';

import {
  getGizletRequestIssueUrl,
  getPlannedGizletRequestPath,
  getPlannedGizletVote,
  gizletRequestPath,
  gizletRequestRepositoryUrl,
  plannedGizletRequestParameter,
  resolvePlannedGizletRequest,
  validateGizletRequest,
} from '../../src/data/gizlet-request';
import { getPlannedTools } from '../../src/data/tools';

const [firstPlanned] = getPlannedTools();

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

  it('keeps a long title within GitHub’s limit, whole title and not just the idea', () => {
    const url = new URL(
      getGizletRequestIssueUrl({ toolIdea: 'a'.repeat(200), useCase: '', contact: '' }),
    );

    expect(url.searchParams.get('title')!.length).toBe(80);
    expect(url.searchParams.get('title')).toMatch(/^Gizlet request: a+$/);
  });
});

describe('a vote for a planned Gizlet', () => {
  it('links a not-built row to the form by naming the Gizlet, not by carrying its copy', () => {
    expect(getPlannedGizletRequestPath(firstPlanned.slug)).toBe(
      `${gizletRequestPath}?${plannedGizletRequestParameter}=${firstPlanned.slug}`,
    );
    expect(getPlannedGizletRequestPath('a b&c')).toBe(
      `${gizletRequestPath}?${plannedGizletRequestParameter}=a%20b%26c`,
    );
  });

  it('resolves the parameter against the registry', () => {
    expect(resolvePlannedGizletRequest(`?gizlet=${firstPlanned.slug}`)).toBe(firstPlanned);
    expect(resolvePlannedGizletRequest(`gizlet=${firstPlanned.slug}&other=1`)).toBe(firstPlanned);
  });

  it('ignores a value the registry does not carry', () => {
    // The security boundary, not a convenience: this value ends up in an issue
    // the visitor files under their own name, so a crafted link must not be
    // able to put an attacker's text into a stranger's public issue.
    for (const search of [
      '',
      '?gizlet=',
      '?gizlet=not-a-gizlet',
      '?gizlet=compress-image',
      '?gizlet=<script>alert(1)</script>',
      '?other=crop-image',
    ]) {
      expect(resolvePlannedGizletRequest(search), search).toBeUndefined();
    }
  });

  it('holds the vote only while the idea field still says what the row said', () => {
    expect(getPlannedGizletVote(firstPlanned.name, firstPlanned.name)).toBe(firstPlanned.name);
    expect(getPlannedGizletVote(firstPlanned.name, `  ${firstPlanned.name}  `)).toBe(
      firstPlanned.name,
    );
    expect(getPlannedGizletVote(firstPlanned.name, 'something else entirely')).toBeUndefined();
    expect(getPlannedGizletVote(undefined, firstPlanned.name)).toBeUndefined();
  });

  it('titles a vote so the issue list can be counted by a title search', () => {
    const vote = new URL(
      getGizletRequestIssueUrl({
        toolIdea: firstPlanned.name,
        useCase: 'I do this every week.',
        contact: '',
        plannedGizlet: firstPlanned.name,
      }),
    );

    expect(vote.searchParams.get('title')).toBe(`Planned Gizlet: ${firstPlanned.name}`);
    expect(vote.searchParams.get('body')).toContain('### Planned Gizlet');
    expect(vote.searchParams.get('body')).toContain(firstPlanned.name);
  });

  it('becomes the visitor’s own request once they rewrite the idea', () => {
    const rewritten = new URL(
      getGizletRequestIssueUrl({
        toolIdea: 'Actually, a blank page remover',
        useCase: '',
        contact: '',
        plannedGizlet: firstPlanned.name,
      }),
    );

    expect(rewritten.searchParams.get('title')).toBe(
      'Gizlet request: Actually, a blank page remover',
    );
    expect(rewritten.searchParams.get('body')).not.toContain('### Planned Gizlet');
  });
});
