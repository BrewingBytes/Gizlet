import { toolRegistry, type ToolRegistryEntry } from '../data/tools';

export type SearchableTool = Pick<
  ToolRegistryEntry,
  'id' | 'name' | 'path' | 'category' | 'description' | 'keywords' | 'processesLocally'
>;

const normalise = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const queryTerms = (query: string) => normalise(query).split(' ').filter(Boolean);

/**
 * Finds Gizlets locally using the catalog fields intended for discovery.
 * Every query term must match so short, unrelated partial matches stay out
 * of the result list.
 */
export function searchTools(
  query: string,
  tools: readonly SearchableTool[] = toolRegistry,
): SearchableTool[] {
  const terms = queryTerms(query);

  if (terms.length === 0) {
    return [];
  }

  const normalisedQuery = terms.join(' ');

  return tools
    .map((tool) => {
      const name = normalise(tool.name);
      const description = normalise(tool.description);
      const keywords = tool.keywords.map(normalise);
      let score = 0;

      for (const term of terms) {
        const inName = name.includes(term);
        const inDescription = description.includes(term);
        const inKeyword = keywords.some((keyword) => keyword.includes(term));

        if (!inName && !inDescription && !inKeyword) {
          return null;
        }

        score += Number(inName) * 8 + Number(inDescription) * 3 + Number(inKeyword) * 5;
      }

      if (name.includes(normalisedQuery)) {
        score += 12;
      }

      return { score, tool };
    })
    .filter((result): result is { score: number; tool: SearchableTool } => result !== null)
    .sort((left, right) => right.score - left.score || left.tool.id - right.tool.id)
    .map(({ tool }) => tool);
}

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true;
  }

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(
    target.type,
  );
}

interface SearchPanel {
  readonly input: HTMLInputElement;
  readonly status: HTMLElement;
  readonly results: HTMLOListElement;
}

function getResultLinks(panel: SearchPanel) {
  return Array.from(panel.results.querySelectorAll<HTMLAnchorElement>('a'));
}

function renderSearchResults(panel: SearchPanel) {
  const query = panel.input.value.trim();
  const matches = searchTools(query);
  panel.results.replaceChildren();

  if (!query) {
    panel.status.textContent = 'Start typing to find a Gizlet.';
    panel.results.hidden = true;
    return;
  }

  if (matches.length === 0) {
    panel.status.textContent = `No Gizlets found for “${query}”.`;
    panel.results.hidden = true;
    return;
  }

  panel.status.textContent = `${matches.length} Gizlet${matches.length === 1 ? '' : 's'} found.`;
  panel.results.hidden = false;

  for (const tool of matches) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const details = document.createElement('span');
    const name = document.createElement('strong');
    const description = document.createElement('span');
    const category = document.createElement('span');

    link.href = tool.path;
    link.className = 'tool-search-result';
    details.className = 'tool-search-result__details';
    name.textContent = tool.name;
    description.textContent = tool.description;
    category.className = 'tool-search-result__category';
    category.textContent = tool.category;

    details.append(name, description);
    link.append(details, category);
    item.append(link);
    panel.results.append(item);
  }
}

function initialiseSearchPanel(element: HTMLElement): SearchPanel | null {
  const input = element.querySelector<HTMLInputElement>('[data-tool-search-input]');
  const status = element.querySelector<HTMLElement>('[data-tool-search-status]');
  const results = element.querySelector<HTMLOListElement>('[data-tool-search-results]');

  if (!input || !status || !results) {
    return null;
  }

  const panel = { input, status, results };
  const form = element.closest('form');

  form?.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('input', () => renderSearchResults(panel));
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') {
      return;
    }

    const [firstResult] = getResultLinks(panel);
    if (firstResult) {
      event.preventDefault();
      firstResult.focus();
    }
  });
  results.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) {
      return;
    }

    const links = getResultLinks(panel);
    const index = links.indexOf(event.target);

    if (event.key === 'ArrowDown' && index < links.length - 1) {
      event.preventDefault();
      links[index + 1]?.focus();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      (links[index - 1] ?? input).focus();
    }
  });

  renderSearchResults(panel);
  return panel;
}

export function initialiseToolSearch() {
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-tool-search-panel]'))
    .map(initialiseSearchPanel)
    .filter((panel): panel is SearchPanel => panel !== null);
  const overlay = document.querySelector<HTMLDialogElement>('[data-search-overlay]');
  const overlayPanel = panels.find((panel) => overlay?.contains(panel.input));
  const openButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-search-open]'));
  let opener: HTMLElement | null = null;

  if (!overlay || !overlayPanel) {
    return;
  }

  const setExpanded = (expanded: boolean) => {
    for (const button of openButtons) {
      button.setAttribute('aria-expanded', String(expanded));
    }
  };

  const openOverlay = (trigger: HTMLElement | null) => {
    opener = trigger;
    overlayPanel.input.value = '';
    renderSearchResults(overlayPanel);
    overlay.showModal();
    setExpanded(true);
    requestAnimationFrame(() => overlayPanel.input.focus());
  };

  for (const button of openButtons) {
    button.addEventListener('click', () => openOverlay(button));
  }

  document.addEventListener('keydown', (event) => {
    if (
      event.key.toLocaleLowerCase() !== 'k' ||
      (!event.metaKey && !event.ctrlKey) ||
      event.altKey ||
      isTextEntry(event.target)
    ) {
      return;
    }

    event.preventDefault();
    openOverlay(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  });

  overlay.addEventListener('close', () => {
    setExpanded(false);
    opener?.focus();
    opener = null;
  });

  overlay.querySelector<HTMLButtonElement>('[data-search-close]')?.addEventListener('click', () => {
    overlay.close();
  });
}
