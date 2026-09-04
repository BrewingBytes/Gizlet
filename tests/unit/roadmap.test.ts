import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getPhaseForPlannedTool,
  getPhaseForTool,
  getPlannedToolChain,
  getPlannedToolChainEntries,
  getPlannedToolsForPhase,
  getRoadmapPhaseAnchor,
  getRoadmapPhaseLabel,
  getRoadmapPhasePath,
  getToolsForPhase,
  plannedToolChains,
  roadmapPath,
  roadmapPhases,
  roadmapRefusals,
  roadmapStatusLabels,
} from '../../src/data/roadmap';
import { canFlowTo, getFlowTool } from '../../src/data/tool-flows';
import {
  getAvailableTools,
  getPlannedTools,
  isAvailableTool,
  isPlannedTool,
  toolRegistry,
} from '../../src/data/tools';

const narrativePath = join(import.meta.dirname, '..', '..', 'docs', 'roadmap.md');

describe('the phases', () => {
  it('gives every phase a unique number, which is its anchor', () => {
    const numbers = roadmapPhases.map((phase) => phase.number);

    expect(new Set(numbers)).toHaveLength(numbers.length);
    expect(roadmapPhases.map(getRoadmapPhaseAnchor)).toEqual(
      numbers.map((number) => `phase-${number}`),
    );
    expect(getRoadmapPhasePath(roadmapPhases[0])).toBe(`${roadmapPath}#phase-0`);
    expect(getRoadmapPhaseLabel(roadmapPhases[0])).toBe('PHASE 0');
  });

  it('names only slugs the registry carries', () => {
    const slugs = new Set(toolRegistry.map((tool) => tool.slug));

    for (const phase of roadmapPhases) {
      for (const slug of phase.toolSlugs) {
        expect(slugs, `phase ${phase.number}`).toContain(slug);
      }

      expect(getToolsForPhase(phase).map((tool) => tool.slug)).toEqual([...phase.toolSlugs]);
    }
  });

  it('places every planned Gizlet in exactly one phase', () => {
    for (const tool of getPlannedTools()) {
      const owning = roadmapPhases.filter((phase) =>
        (phase.toolSlugs as readonly string[]).includes(tool.slug),
      );

      expect(owning.map((phase) => phase.number), tool.slug).toHaveLength(1);
      expect(getPhaseForPlannedTool(tool)).toBe(owning[0]);
    }

    expect(
      roadmapPhases.flatMap((phase) => getPlannedToolsForPhase(phase).map((tool) => tool.slug)).sort(),
    ).toEqual(getPlannedTools().map((tool) => tool.slug).sort());
  });

  it('does not put a Gizlet in two phases at once, planned or shipped', () => {
    const named = roadmapPhases.flatMap((phase) => [...phase.toolSlugs]);

    expect(new Set(named)).toHaveLength(named.length);
  });

  it('states a signal and a stopping condition for every phase, and a standing for a shipped one', () => {
    for (const phase of roadmapPhases) {
      expect(phase.signal.length, `phase ${phase.number}`).toBeGreaterThan(0);
      expect(phase.killCriterion.length, `phase ${phase.number}`).toBeGreaterThan(0);
      expect(phase.sharedMachinery.length, `phase ${phase.number}`).toBeGreaterThan(0);
      expect(roadmapStatusLabels[phase.status]).toBeDefined();

      // A shipped phase is judged in the past tense rather than left as an
      // intention that happens to be true, and only a shipped phase is.
      expect(Boolean(phase.standing), `phase ${phase.number}`).toBe(phase.status === 'shipped');
    }
  });

  it('claims nothing about a Gizlet that has no implementation to claim it of', () => {
    expect(getPlannedTools().some((tool) => tool.processesLocally)).toBe(false);
    expect(
      getPlannedTools().every((tool) => !('agent' in tool)),
      'a planned entry carries no agent-facing description',
    ).toBe(true);
  });

  it('refuses a planned Gizlet that belongs to no phase', () => {
    const orphan = {
      ...getPlannedTools()[0],
      slug: 'not-in-any-phase',
    };

    expect(() => getPhaseForPlannedTool(orphan)).toThrow(/belongs to no roadmap phase/);
    expect(getPhaseForTool('not-a-gizlet')).toBeUndefined();
  });
});

describe('the chains a planned Gizlet would finish', () => {
  it('gives each chain to exactly one planned Gizlet, and only to a planned one', () => {
    const slugs = plannedToolChains.map((entry) => entry.slug);
    const planned = new Set(getPlannedTools().map((tool) => tool.slug));

    expect(new Set(slugs)).toHaveLength(slugs.length);
    for (const slug of slugs) {
      expect(planned).toContain(slug);
    }
  });

  it('names exactly one planned step in a chain, and it is the chain’s own Gizlet', () => {
    for (const { slug } of plannedToolChains) {
      const steps = getPlannedToolChainEntries(slug);
      const plannedSteps = steps.filter(isPlannedTool);

      expect(steps.length, slug).toBeGreaterThan(1);
      expect(plannedSteps.map((step) => step.slug), slug).toEqual([slug]);
    }
  });

  it('only claims hand-offs the flow graph really permits', () => {
    for (const { slug } of plannedToolChains) {
      const steps = getPlannedToolChainEntries(slug);

      for (let index = 0; index < steps.length - 1; index += 1) {
        const from = steps[index];
        const to = steps[index + 1];

        // A planned step has no contract to check: it has no implementation to
        // have one about. The pairs that can be checked are checked, so a chain
        // that grows a second available adjacency cannot invent a hand-off.
        if (!isAvailableTool(from) || !isAvailableTool(to)) continue;

        expect(canFlowTo(from.slug, to.slug), `${slug}: ${from.slug} → ${to.slug}`).toBe(true);
      }
    }
  });

  it('uses only live steps that are actually in the flow graph', () => {
    for (const { slug } of plannedToolChains) {
      for (const step of getPlannedToolChainEntries(slug).filter(isAvailableTool)) {
        // Catches a Gizlet that deliberately declares no contract — one that
        // only shows a visitor something is not a pipeline step, so a chain
        // that used it would be describing a hand-off that cannot happen.
        expect(() => getFlowTool(step.slug), `${slug}: ${step.slug}`).not.toThrow();
      }
    }
  });

  it('has no chain for a Gizlet that completes none', () => {
    expect(getPlannedToolChain('trim-video')).toEqual([]);
    expect(getPlannedToolChain('compress-image')).toEqual([]);
    expect(getPlannedToolChainEntries('not-a-gizlet')).toEqual([]);
  });
});

describe('the refusals', () => {
  it('sends every refusal somewhere that does do the job', () => {
    expect(roadmapRefusals).toHaveLength(4);

    for (const refusal of roadmapRefusals) {
      expect(refusal.useInstead.length, refusal.subject).toBeGreaterThan(0);
      expect(new URL(refusal.useInsteadUrl).protocol, refusal.subject).toBe('https:');
      // The reason gets more words than the refusal it explains: a one-line
      // "no" is a brand decision, and a paragraph is an argument.
      expect(refusal.reason.length, refusal.subject).toBeGreaterThan(refusal.subject.length * 4);
    }
  });

  it('refuses nothing the registry says it builds', () => {
    const names = new Set(toolRegistry.map((tool) => tool.name.toLowerCase()));

    for (const refusal of roadmapRefusals) {
      expect(names, refusal.subject).not.toContain(refusal.subject.toLowerCase());
    }
  });
});

describe('docs/roadmap.md', () => {
  const narrative = readFileSync(narrativePath, 'utf8');

  it('duplicates no list, so there is one place a reader can be told something false', () => {
    for (const tool of toolRegistry) {
      expect(narrative, `names ${tool.name}`).not.toContain(tool.name);
      expect(narrative, `names ${tool.slug}`).not.toContain(tool.slug);
      expect(narrative, `routes to ${tool.path}`).not.toContain(tool.path);
    }
  });

  it('writes no phase number by hand', () => {
    expect(narrative).not.toMatch(/phase\s+\d/i);
    for (const phase of roadmapPhases) {
      expect(narrative, phase.title).not.toContain(phase.title);
    }
  });

  it('points at the data rather than restating it', () => {
    expect(narrative).toContain('src/data/roadmap.ts');
    expect(narrative).toContain('src/data/tools.ts');
    expect(narrative).toContain('signals.md');
  });
});

describe('the surfaces the roadmap feeds', () => {
  it('publishes at one route, which the registry never uses', () => {
    expect(roadmapPath).toBe('/roadmap/');
    expect(toolRegistry.map((tool) => tool.path)).not.toContain(roadmapPath);
  });

  it('accounts for every registry entry as either shipped or planned', () => {
    expect(getAvailableTools().length + getPlannedTools().length).toBe(toolRegistry.length);
  });
});
