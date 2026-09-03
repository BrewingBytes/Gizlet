/**
 * Turns Conventional Commit titles into a draft Keep a Changelog section.
 *
 * This module is deliberately pure: it reads no files and shells out to
 * nothing, so tests/unit/changelog.test.ts can cover the parsing and the
 * type-to-section mapping directly. scripts/draft-changelog.mjs supplies the
 * git history and does the file I/O around it.
 *
 * The output is a draft, never a finished changelog. Existing entries are
 * written in an editorial voice that is richer than any commit subject, so the
 * releaser edits what this produces before committing it. See
 * docs/releasing.md.
 */

/** Keep a Changelog headings, in the order the changelog uses them. */
export const changelogSections = ['Added', 'Changed', 'Fixed'];

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
