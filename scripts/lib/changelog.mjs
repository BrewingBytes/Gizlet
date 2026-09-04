/**
 * The two halves of how this project writes a changelog: drafting entries from
 * Conventional Commit titles, and collecting the `changelog.d/` fragments that
 * pull requests write into one release section.
 *
 * This module is deliberately pure: it reads no files and shells out to
 * nothing, so tests/unit/changelog.test.ts can cover the parsing, the
 * type-to-section mapping, and the fragment rules directly.
 * scripts/draft-changelog.mjs supplies the git history and
 * scripts/collect-changelog.mjs supplies the fragments; both do the file I/O.
 *
 * A drafted entry is never a finished changelog. Existing entries are written
 * in an editorial voice that is richer than any commit subject, so the author
 * edits what this produces before committing it. See docs/releasing.md.
 */

/** Keep a Changelog headings, in the order the changelog renders them. */
export const changelogSections = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

/**
 * Which section each Conventional Commit type drafts into.
 *
 * `null` means the type has no external impact on its own, matching the
 * changelog's release policy that internal maintenance needs no entry. A
 * maintenance commit that did change something visible is added by hand.
 */
const sectionByType = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Changed',
  docs: 'Changed',
  revert: 'Changed',
  refactor: null,
  build: null,
  chore: null,
  ci: null,
  style: null,
  test: null,
};

const conventionalTitle = /^(?<type>[a-z]+)(?:\((?<scope>[^()]+)\))?(?<breaking>!)?: (?<description>.+)$/;

/**
 * Parses one commit subject line.
 *
 * @param {string} title
 * @returns {{ type: string, scope: string | null, breaking: boolean, description: string } | null}
 *   `null` when the line is not a Conventional Commit subject, which is how
 *   merge commits and any history predating the CI title check are skipped.
 */
export function parseCommitTitle(title) {
  const match = conventionalTitle.exec(title.trim());
  if (!match?.groups) {
    return null;
  }

  const { type, scope, breaking, description } = match.groups;
  // Squash merges append the pull request number to the subject; it belongs in
  // the git history, not in a changelog entry.
  const trimmedDescription = description.replace(/\s*\(#\d+\)$/, '').trim();
  if (trimmedDescription === '') {
    return null;
  }

  return {
    type,
    scope: scope?.trim() || null,
    breaking: breaking === '!',
    description: trimmedDescription,
  };
}

/**
 * Maps a parsed commit onto a changelog section.
 *
 * A breaking change always earns an entry, even for a type that is otherwise
 * omitted, because a maintainer needs to read about it.
 *
 * @param {{ type: string, breaking: boolean }} commit
 * @returns {string | null} the section heading, or `null` to omit the commit.
 */
export function changelogSectionFor(commit) {
  const mapped = sectionByType[commit.type];
  if (mapped) {
    return mapped;
  }

  return commit.breaking ? 'Changed' : null;
}

/**
 * Renders one commit as a changelog bullet's text.
 *
 * @param {{ breaking: boolean, description: string }} commit
 * @returns {string}
 */
export function formatEntry(commit) {
  const sentence = commit.description.charAt(0).toUpperCase() + commit.description.slice(1);
  const punctuated = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  return commit.breaking ? `**Breaking:** ${punctuated}` : punctuated;
}

/**
 * Drafts the changelog sections for a list of commit subject lines.
 *
 * Titles are expected newest first, the order `git log` prints them, and the
 * draft reverses them so entries read oldest to newest within a section.
 * Duplicate entries collapse, which matters when a fix was cherry-picked.
 *
 * @param {readonly string[]} titles
 * @returns {Record<string, string[]>} only the sections that drafted an entry.
 */
export function draftSections(titles) {
  const drafted = {};

  for (const title of [...titles].reverse()) {
    const commit = parseCommitTitle(title);
    if (!commit) {
      continue;
    }

    const section = changelogSectionFor(commit);
    if (!section) {
      continue;
    }

    const entry = formatEntry(commit);
    const entries = (drafted[section] ??= []);
    if (!entries.includes(entry)) {
      entries.push(entry);
    }
  }

  return Object.fromEntries(
    changelogSections.filter((section) => drafted[section]).map((section) => [section, drafted[section]]),
  );
}

/**
 * Renders drafted sections as the markdown that belongs under `## [Unreleased]`.
 *
 * @param {Record<string, readonly string[]>} sections
 * @returns {string} an empty string when nothing was drafted.
 */
export function formatDraft(sections) {
  const blocks = changelogSections
    .filter((section) => sections[section]?.length)
    .map((section) => `### ${section}\n\n${sections[section].map((entry) => `- ${entry}`).join('\n')}`);

  return blocks.join('\n\n');
}

/**
 * A fragment file name: the lowercased section, a hyphen, then a kebab-case
 * slug. `added-image-to-pdf-preview.md` is an Added entry.
 */
const fragmentFile = /^(?<section>[a-z]+)-(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

const sectionByLowercaseName = Object.fromEntries(
  changelogSections.map((section) => [section.toLowerCase(), section]),
);

/**
 * Reads a fragment's section and slug out of its file name.
 *
 * @param {string} fileName
 * @returns {{ section: string, slug: string } | null} `null` when the name does
 *   not follow the convention or names a section the changelog does not use.
 */
export function parseFragmentName(fileName) {
  const match = fragmentFile.exec(fileName);
  if (!match?.groups) {
    return null;
  }

  const section = sectionByLowercaseName[match.groups.section];
  return section ? { section, slug: match.groups.slug } : null;
}

/**
 * Builds the fragment file name for an entry, so a drafted entry and a
 * hand-written one are named the same way.
 *
 * The slug is short on purpose: it exists to keep two fragments in one release
 * apart and to say roughly what the entry is about, not to summarise it.
 *
 * @param {string} section a heading from `changelogSections`.
 * @param {string} description the entry's subject, in any casing.
 * @returns {string}
 */
export function fragmentFileName(section, description) {
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word !== '')
    .slice(0, 6);

  const slug = words.join('-') || 'entry';
  return `${section.toLowerCase()}-${slug}.md`;
}

/**
 * Groups fragments into changelog sections, ready to render.
 *
 * Fragments within a section are ordered by file name, so the release section
 * reads the same for everyone regardless of the order the files were written
 * or the order the filesystem hands them over.
 *
 * @param {readonly { name: string, body: string }[]} fragments
 * @returns {Record<string, string[]>} only the sections that have a fragment.
 * @throws {Error} listing every fragment that does not follow the convention,
 *   because a releaser wants all of them at once, not one per run.
 */
export function collectFragments(fragments) {
  const problems = [];
  const collected = {};

  for (const { name, body } of [...fragments].sort((a, b) => a.name.localeCompare(b.name))) {
    const parsed = parseFragmentName(name);
    if (!parsed) {
      problems.push(`${name}: name a section and a slug, as in added-image-to-pdf-preview.md.`);
      continue;
    }

    const entry = body.trim();
    if (entry === '') {
      problems.push(`${name}: the fragment is empty.`);
      continue;
    }

    if (!entry.startsWith('- ')) {
      problems.push(`${name}: a fragment holds changelog bullets, so it starts with "- ".`);
      continue;
    }

    (collected[parsed.section] ??= []).push(entry);
  }

  if (problems.length > 0) {
    throw new Error(`changelog.d holds ${problems.length} fragment(s) it cannot read:\n${problems.join('\n')}`);
  }

  return Object.fromEntries(
    changelogSections.filter((section) => collected[section]).map((section) => [section, collected[section]]),
  );
}

/**
 * Renders collected fragments as the body of a release section.
 *
 * A fragment already holds its own bullets, so its text is emitted as written
 * rather than reformatted; this only supplies the headings and their order.
 *
 * @param {Record<string, readonly string[]>} sections
 * @returns {string} an empty string when there is nothing to release.
 */
export function formatRelease(sections) {
  const blocks = changelogSections
    .filter((section) => sections[section]?.length)
    .map((section) => `### ${section}\n\n${sections[section].join('\n')}`);

  return blocks.join('\n\n');
}
