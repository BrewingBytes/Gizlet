import { siteUrl } from './metadata';
import { getPhaseForTool, roadmapPath } from './roadmap';
import type { AvailableToolEntry, ToolRegistryEntry } from './tools';
import { isAvailableTool, isPlannedTool, toolRegistry } from './tools';

const cataloguePath = '/tools.json';
const llmsPath = '/llms.txt';
const localPrivacyStatement =
  'For Gizlets marked local, entered content, files, and generated results are processed in the browser and remain on-device. Gizlet does not transmit or persist those payloads through this catalogue.';
const plannedNotice =
  'Gizlets listed as planned are not built. Their pages render a placeholder, they accept no input and produce no output, and they must not be presented, called, or described as available actions. The roadmap says why each one is not built yet.';

/** What every catalogue entry says, whether the Gizlet is built or planned. */
export interface AgentCatalogToolBase {
  readonly name: string;
  readonly slug: string;
  readonly route: string;
  readonly category: ToolRegistryEntry['category'];
  readonly purpose: string;
}

export interface AvailableAgentCatalogTool extends AgentCatalogToolBase {
  readonly availability: 'available';
  readonly localProcessing: boolean;
  readonly input: string;
  readonly output: string;
  readonly privacy: string;
}

/**
 * A planned Gizlet, published so the catalogue describes the plan as well as
 * the product — and shaped so it cannot be mistaken for something callable.
 *
 * The omissions are the design. There is no `localProcessing` key, because
 * locality is a claim about an implementation and this has none; publishing
 * `false` would read as "this one uploads your file", which is a different and
 * equally untrue statement. There is no `input` or `output`, because there is
 * no contract to describe, and no privacy sentence, because the sentence the
 * available shape uses would send a reader to a page that has no processing to
 * explain. A reader is never asked to infer that a key name means "do not call
 * this": the fields that would let it be called simply do not exist.
 */
export interface PlannedAgentCatalogTool extends AgentCatalogToolBase {
  readonly availability: 'planned';
  /** Where the roadmap explains the reason and the order. */
  readonly roadmapUrl: string;
}

export type AgentCatalogTool = AvailableAgentCatalogTool | PlannedAgentCatalogTool;

export interface AgentCatalog {
  readonly name: 'Gizlet';
  readonly catalogueUrl: string;
  readonly privacy: string;
  readonly tools: readonly AvailableAgentCatalogTool[];
  /** What Gizlet intends to build. Separate key, separate shape, not actions. */
  readonly plannedNotice: string;
  readonly planned: readonly PlannedAgentCatalogTool[];
}

function getToolPrivacy(tool: AvailableToolEntry): string {
  return tool.processesLocally
    ? 'Local: this tool processes its input in the browser. Input, files, and generated output stay on-device.'
    : 'Processing details are provided on the tool page.';
}

function getRoadmapUrl(tool: ToolRegistryEntry): string {
  const phase = getPhaseForTool(tool.slug);

  return new URL(
    phase ? `${roadmapPath}#phase-${phase.number}` : roadmapPath,
    siteUrl,
  ).toString();
}

/**
 * Produces the public, agent-readable catalogue from the typed tool registry.
 *
 * Planned entries are published under their own key rather than excluded. That
 * is a deliberate reversal of the earlier rule: a catalogue that describes only
 * what exists cannot answer "is this coming?", and the honest answer to that
 * question is more useful than silence. What has not changed is that a planned
 * Gizlet is never an available action, which the shapes above enforce.
 */
export function getAgentCatalog(
  tools: readonly ToolRegistryEntry[] = toolRegistry,
): AgentCatalog {
  return {
    name: 'Gizlet',
    catalogueUrl: new URL(cataloguePath, siteUrl).toString(),
    privacy: localPrivacyStatement,
    tools: tools.filter(isAvailableTool).map((tool) => ({
      name: tool.name,
      slug: tool.slug,
      route: new URL(tool.path, siteUrl).toString(),
      category: tool.category,
      availability: 'available' as const,
      localProcessing: tool.processesLocally,
      purpose: tool.description,
      input: tool.agent.input,
      output: tool.agent.output,
      privacy: getToolPrivacy(tool),
    })),
    plannedNotice,
    planned: tools.filter(isPlannedTool).map((tool) => ({
      name: tool.name,
      slug: tool.slug,
      route: new URL(tool.path, siteUrl).toString(),
      category: tool.category,
      availability: 'planned' as const,
      purpose: tool.description,
      roadmapUrl: getRoadmapUrl(tool),
    })),
  };
}

/**
 * Produces the plain-text discovery document served from /llms.txt.
 *
 * The planned half is a heading rather than a key, because this document is
 * plaintext and has no keys. The heading carries the whole claim — the Gizlets
 * under it are not available — and each line says so again by ending in the
 * roadmap link instead of an input and output description.
 */
export function getLlmsTxt(tools: readonly ToolRegistryEntry[] = toolRegistry): string {
  const catalogue = getAgentCatalog(tools);
  const toolLines = catalogue.tools.map((tool) =>
    `- [${tool.name}](${tool.route}): ${tool.purpose} Input: ${tool.input} Output: ${tool.output} ${tool.privacy}`,
  );
  const plannedLines = catalogue.planned.map((tool) =>
    `- ${tool.name} (${tool.route}): ${tool.purpose} Not built yet: ${tool.roadmapUrl}`,
  );

  return [
    '# Gizlet',
    '',
    '> Small, useful browser tools. No signup and no hosted tool API.',
    '',
    '## Discovery',
    '',
    `- [Machine-readable tool catalogue](${catalogue.catalogueUrl})`,
    `- [Privacy policy](${new URL('/privacy/', siteUrl).toString()})`,
    `- [Roadmap](${new URL(roadmapPath, siteUrl).toString()})`,
    '',
    '## Privacy boundary',
    '',
    catalogue.privacy,
    '',
    '## Available Gizlets',
    '',
    ...toolLines,
    '',
    '## Planned Gizlets — not available',
    '',
    catalogue.plannedNotice,
    '',
    ...plannedLines,
    '',
  ].join('\n');
}

export const agentCatalogPaths = {
  catalogue: cataloguePath,
  llms: llmsPath,
} as const;
