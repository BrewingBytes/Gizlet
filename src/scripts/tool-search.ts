import { getAvailableTools, type ToolRegistryEntry } from '../data/tools';

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

/**
 * Words that join a query rather than name a Gizlet. "jpg to png" asks about the
 * two formats; scoring "to" as well would rank every tool whose name or
 * description happens to contain it above the tool the query is actually for.
 */
const connectorWords = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'into',
  'my',
  'of',
  'or',
  'the',
  'to',
]);

const queryTerms = (query: string) =>
  normalise(query)
    .split(' ')
    .filter((term) => term.length > 0 && !connectorWords.has(term));

/**
 * Whether a term begins a word in the text.
 *
 * Matching a raw substring made a term match for reasons nobody chose: "a" and
 * "an" matched every Gizlet because their letters sit inside other words, while
 * "make" matched none. A term is a word a visitor typed, so it has to line up
 * with a word in the registry — from the start of one, because the field is
 * searched as it is typed and "compres" is a query on its way to "compress".
 */
function beginsWord(text: string, term: string): boolean {
  for (let index = text.indexOf(term); index !== -1; index = text.indexOf(term, index + 1)) {
    if (index === 0 || text[index - 1] === ' ') {
      return true;
    }
  }

  return false;
}

/**
 * Finds Gizlets locally using the catalog fields intended for discovery.
 *
 * A result has to match as much of the query as anything else does: every
 * Gizlet is scored over the terms it matches, and only those matching the
 * largest number of them are returned. That is what keeps a loose partial match
 * out — "compress photo" still returns only Compress Image, though Resize Image
 * knows "photo" — while a word the registry has never heard of no longer empties
 * the list. The field is labelled "I need to…", so it invites exactly the words
 * a catalogue of nouns cannot contain: "make JSON-LD" asks for the Gizlet that
 * matches both of the other two terms, not for nothing at all.
 *
 * Requiring every term to match was the earlier rule, and the reason it is gone
 * rather than patched with a list of verbs to ignore: such a list has to know
 * that "add" means nothing while "crop" does, and it stops being true the day a
 * Gizlet ships with "add watermark" among its keywords. Counting matched terms
 * needs no list and survives the registry growing, because the Gizlet that
 * matches more of the query wins whatever the words are.
 *
 * The default is the available Gizlets, not the whole registry. A result is a
 * link a visitor is about to follow, so a planned Gizlet appearing here would
 * be an invitation to a page that does nothing.
 */
export function searchTools(
  query: string,
  tools: readonly SearchableTool[] = getAvailableTools(),
): SearchableTool[] {
  const terms = queryTerms(query);

  if (terms.length === 0) {
    return [];
  }

  const phrase = normalise(query);
  const scored = tools
    .map((tool) => {
      const name = normalise(tool.name);
      const description = normalise(tool.description);
      const keywords = tool.keywords.map(normalise);
      let matched = 0;
      let score = 0;

      for (const term of terms) {
        const inName = beginsWord(name, term);
        const inDescription = beginsWord(description, term);
        const inKeyword = keywords.some((keyword) => beginsWord(keyword, term));

        if (!inName && !inDescription && !inKeyword) {
          continue;
        }

        matched += 1;
        score += Number(inName) * 8 + Number(inDescription) * 3 + Number(inKeyword) * 5;
      }

      if (matched === 0) {
        return null;
      }

      if (beginsWord(name, phrase)) {
        score += 12;
      } else if (keywords.some((keyword) => beginsWord(keyword, phrase))) {
        score += 10;
      }

      return { matched, score, tool };
    })
    .filter((result): result is { matched: number; score: number; tool: SearchableTool } =>
      result !== null,
    );

  if (scored.length === 0) {
    return [];
  }

  const bestCoverage = Math.max(...scored.map((result) => result.matched));

  // A result also has to answer at least half of what was asked. Without a
  // floor, one weak term carries a whole query: "make a qr code" would return
  // Collage Maker, because "maker" begins with "make" and nothing here knows
  // what a QR code is. Half is the loosest floor that still lets "tidy JSON"
  // through on the one word of two that means anything.
  if (bestCoverage * 2 < terms.length) {
    return [];
  }

  return scored
    .filter((result) => result.matched === bestCoverage)
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
