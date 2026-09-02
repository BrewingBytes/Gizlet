export interface GizletRequestValues {
  readonly toolIdea: string;
  readonly useCase: string;
  readonly contact: string;
}

export type GizletRequestErrors = Partial<Record<keyof GizletRequestValues, string>>;

export const gizletRequestRepositoryUrl = 'https://github.com/BrewingBytes/Gizlet';

const minimumToolIdeaLength = 3;
const githubIssueTitleLimit = 80;

function normalise(value: string): string {
  return value.trim();
}

/** Validates only the information Gizlet needs before preparing a GitHub issue. */
export function validateGizletRequest(values: GizletRequestValues): GizletRequestErrors {
  const toolIdea = normalise(values.toolIdea);

  if (!toolIdea) {
    return { toolIdea: 'Tell us the Gizlet you would like us to make.' };
  }

  if (toolIdea.length < minimumToolIdeaLength) {
    return { toolIdea: 'Use at least three characters so we can understand the idea.' };
  }

  return {};
}

/**
 * Builds the static site's approved delivery handoff: a pre-filled GitHub
 * issue. The browser does not send form values to Gizlet.
 */
export function getGizletRequestIssueUrl(values: GizletRequestValues): string {
  const toolIdea = normalise(values.toolIdea);
  const useCase = normalise(values.useCase);
  const contact = normalise(values.contact);
  const issueUrl = new URL('/BrewingBytes/Gizlet/issues/new', 'https://github.com');

  issueUrl.searchParams.set('title', `Gizlet request: ${toolIdea.slice(0, githubIssueTitleLimit)}`);
  issueUrl.searchParams.set(
    'body',
    [
      '## Gizlet request',
      '',
      '### Tool idea',
      toolIdea,
      '',
      '### How I would use it',
      useCase || '_Not provided_',
      '',
      '### Contact',
      contact || '_Not provided_',
    ].join('\n'),
  );

  return issueUrl.toString();
}
