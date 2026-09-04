import { getPlannedToolBySlug, type PlannedTool } from './tools';

export interface GizletRequestValues {
  readonly toolIdea: string;
  readonly useCase: string;
  readonly contact: string;
  /**
   * The planned Gizlet this request is a vote for, when it arrived from a row
   * in the not-built block rather than from someone typing an idea.
   */
  readonly plannedGizlet?: string;
}

export type GizletRequestErrors = Partial<Record<keyof GizletRequestValues, string>>;

export const gizletRequestRepositoryUrl = 'https://github.com/BrewingBytes/Gizlet';

/** The route the request form is published at. */
export const gizletRequestPath = '/request-a-gizlet/';

const minimumToolIdeaLength = 3;
const githubIssueTitleLimit = 80;

/**
 * The query parameter a not-built row passes its Gizlet through.
 *
 * It has to be a parameter rather than build-time state: `output: "static"`
 * means the request page is one prerendered document, so nothing about which
 * row was clicked can be known in Astro frontmatter.
 */
export const plannedGizletRequestParameter = 'gizlet';

/**
 * The request link a not-built row carries. It names the Gizlet rather than
 * carrying its own copy of it: the page resolves the slug back to the registry,
 * so the only thing this link can prefill is a Gizlet that really is planned.
 */
export function getPlannedGizletRequestPath(slug: string): string {
  return `${gizletRequestPath}?${plannedGizletRequestParameter}=${encodeURIComponent(slug)}`;
}

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
 * Resolves a not-built row's parameter to the planned Gizlet it names.
 *
 * The resolution against the registry is the security boundary, not a
 * convenience. This value ends up in a GitHub issue that the visitor files
 * under their own name, so an unrecognised parameter is ignored outright: were
 * it echoed back, a crafted link would put an attacker's text into a stranger's
 * public issue, on the one form whose entire design is that the visitor rather
 * than Gizlet does the submitting.
 */
export function resolvePlannedGizletRequest(search: string): PlannedTool | undefined {
  const requested = new URLSearchParams(search).get(plannedGizletRequestParameter);

  return requested ? getPlannedToolBySlug(requested) : undefined;
}

/**
 * The vote a prepared request carries, which holds only while the idea field
 * still says what the row said.
 *
 * Once a visitor rewrites the idea, the request is their own and counting it
 * as a vote for the row they arrived from would overstate the row's demand.
 */
export function getPlannedGizletVote(
  plannedName: string | undefined,
  toolIdea: string,
): string | undefined {
  return plannedName && normalise(toolIdea) === plannedName ? plannedName : undefined;
}

/**
 * Builds the static site's approved delivery handoff: a pre-filled GitHub
 * issue. The browser does not send form values to Gizlet.
 *
 * A vote for a planned Gizlet takes a fixed title prefix, because the title is
 * what makes demand countable: reading the issue list is the only instrument
 * this project has, and a title search is a count where parsing issue bodies is
 * a chore nobody will do.
 */
export function getGizletRequestIssueUrl(values: GizletRequestValues): string {
  const toolIdea = normalise(values.toolIdea);
  const useCase = normalise(values.useCase);
  const contact = normalise(values.contact);
  const plannedGizlet = getPlannedGizletVote(
    values.plannedGizlet ? normalise(values.plannedGizlet) : undefined,
    values.toolIdea,
  );
  const issueUrl = new URL('/BrewingBytes/Gizlet/issues/new', 'https://github.com');
  const title = plannedGizlet
    ? `Planned Gizlet: ${plannedGizlet}`
    : `Gizlet request: ${toolIdea}`;

  issueUrl.searchParams.set('title', title.slice(0, githubIssueTitleLimit));
  issueUrl.searchParams.set(
    'body',
    [
      '## Gizlet request',
      '',
      ...(plannedGizlet ? ['### Planned Gizlet', plannedGizlet, ''] : []),
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
