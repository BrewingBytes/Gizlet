/**
 * Drafts changelog entries for the next release from the Conventional Commit
 * titles between the previous version tag and HEAD.
 *
 *   pnpm run changelog:draft              # print the draft, write nothing
 *   pnpm run changelog:draft -- --write   # merge the draft into CHANGELOG.md
 *   pnpm run changelog:draft -- --since v0.1.0
 *
 * The draft is a starting point, not a finished changelog. Entries already
 * written under `## [Unreleased]` are never rewritten or removed: --write only
 * appends beneath them, so a release stays possible when the draft is edited
 * down or discarded entirely. See docs/releasing.md.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { changelogSections, draftSections, formatDraft } from './lib/changelog.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(repositoryRoot, 'CHANGELOG.md');
const unreleasedHeading = '## [Unreleased]';

function git(...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function parseArguments(argv) {
  const options = { write: false, since: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') {
      options.write = true;
    } else if (argument === '--since') {
      options.since = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--since=')) {
      options.since = argument.slice('--since='.length);
    } else if (argument === '--preview' || argument === '--dry-run') {
      options.write = false;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

/** The most recent `v*` tag reachable from HEAD, or null before the first release. */
function previousTag() {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v*');
  } catch {
    return null;
  }
}

function commitTitles(since) {
  const range = since ? `${since}..HEAD` : 'HEAD';
  const log = git('log', '--no-merges', '--format=%s', range);
  return log === '' ? [] : log.split('\n');
}

/**
 * Appends the drafted entries under `## [Unreleased]`, keeping every entry that
 * is already there and adding any section the draft needs but the changelog
 * does not have yet.
 */
function mergeIntoUnreleased(changelog, sections) {
  const start = changelog.indexOf(unreleasedHeading);
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no ${unreleasedHeading} section to draft into.`);
  }

  const bodyStart = start + unreleasedHeading.length;
  const nextHeading = changelog.indexOf('\n## ', bodyStart);
  const bodyEnd = nextHeading === -1 ? changelog.length : nextHeading;
  let body = changelog.slice(bodyStart, bodyEnd);

  for (const section of changelogSections) {
    const entries = sections[section];
    if (!entries?.length) {
      continue;
    }

    const bullets = entries.map((entry) => `- ${entry}`).join('\n');
    const headingIndex = body.indexOf(`### ${section}\n`);

    if (headingIndex === -1) {
      body = `${body.replace(/\s+$/, '')}\n\n### ${section}\n\n${bullets}\n`;
      continue;
    }

    const sectionStart = headingIndex + `### ${section}\n`.length;
    const nextSection = body.indexOf('\n### ', sectionStart);
    const sectionEnd = nextSection === -1 ? body.length : nextSection;
    const existing = body.slice(sectionStart, sectionEnd).replace(/\s+$/, '');
    body = `${body.slice(0, sectionStart)}${existing}\n${bullets}\n${body.slice(sectionEnd)}`;
  }

  return `${changelog.slice(0, bodyStart)}${body}${changelog.slice(bodyEnd)}`;
}

const options = parseArguments(process.argv.slice(2));
const since = options.since ?? previousTag();
const titles = commitTitles(since);
const sections = draftSections(titles);
const draft = formatDraft(sections);

const range = since ? `${since}..HEAD` : 'the start of history';
process.stderr.write(`Read ${titles.length} commit title(s) from ${range}.\n`);

if (draft === '') {
  process.stderr.write('No commit in that range drafts a changelog entry.\n');
  process.exit(0);
}

if (!options.write) {
  process.stderr.write('Preview only; CHANGELOG.md was not written. Re-run with --write to merge.\n\n');
  process.stdout.write(`${draft}\n`);
  process.exit(0);
}

const changelog = await readFile(changelogPath, 'utf8');
await writeFile(changelogPath, mergeIntoUnreleased(changelog, sections), 'utf8');
process.stderr.write('Merged the draft into CHANGELOG.md under [Unreleased]. Review and edit it before committing.\n');
