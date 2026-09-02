import { siteUrl } from './metadata';
import type { ToolRegistryEntry } from './tools';
import { toolRegistry } from './tools';

const cataloguePath = '/tools.json';
const llmsPath = '/llms.txt';
const localPrivacyStatement =
  'For Gizlets marked local, entered content, files, and generated results are processed in the browser and remain on-device. Gizlet does not transmit or persist those payloads through this catalogue.';

export interface AgentCatalogTool {
  readonly name: string;
  readonly slug: string;
  readonly route: string;
  readonly category: ToolRegistryEntry['category'];
  readonly availability: 'available';
  readonly localProcessing: boolean;
  readonly purpose: string;
  readonly input: string;
  readonly output: string;
  readonly privacy: string;
}

export interface AgentCatalog {
  readonly name: 'Gizlet';
  readonly catalogueUrl: string;
  readonly privacy: string;
  readonly tools: readonly AgentCatalogTool[];
}

function getToolPrivacy(tool: ToolRegistryEntry): string {
  return tool.processesLocally
    ? 'Local: this tool processes its input in the browser. Input, files, and generated output stay on-device.'
    : 'Processing details are provided on the tool page.';
}

/**
 * Produces the public, agent-readable catalogue from the typed tool registry.
 * Planned entries are deliberately excluded: they are not available actions.
 */
export function getAgentCatalog(
  tools: readonly ToolRegistryEntry[] = toolRegistry,
): AgentCatalog {
  return {
    name: 'Gizlet',
    catalogueUrl: new URL(cataloguePath, siteUrl).toString(),
    privacy: localPrivacyStatement,
    tools: tools
      .filter((tool) => tool.launchStatus === 'available')
      .map((tool) => ({
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
  };
}

/** Produces the plain-text discovery document served from /llms.txt. */
export function getLlmsTxt(tools: readonly ToolRegistryEntry[] = toolRegistry): string {
  const catalogue = getAgentCatalog(tools);
  const toolLines = catalogue.tools.map((tool) =>
    `- [${tool.name}](${tool.route}): ${tool.purpose} Input: ${tool.input} Output: ${tool.output} ${tool.privacy}`,
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
    '',
    '## Privacy boundary',
    '',
    catalogue.privacy,
    '',
    '## Available Gizlets',
    '',
    ...toolLines,
    '',
  ].join('\n');
}

export const agentCatalogPaths = {
  catalogue: cataloguePath,
  llms: llmsPath,
} as const;
