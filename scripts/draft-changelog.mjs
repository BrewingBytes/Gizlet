/**
 * Drafts changelog entries from the Conventional Commit titles in a range,
 * writing each one as its own file in changelog.d/.
 *
 *   pnpm run changelog:draft                          # print the draft, write nothing
 *   pnpm run changelog:draft -- --write               # write a fragment per entry
 *   pnpm run changelog:draft -- --since origin/main   # just this branch's commits
 *
 * The draft is a starting point, not a finished changelog: rewrite the file it
 * writes, merge several into one, or delete the ones describing work nobody
 * outside the repository can see. An existing fragment is never overwritten, so
 * the script can be re-run on a branch that already has an edited entry.
 * scripts/collect-changelog.mjs turns the fragments into a release section, and
 * docs/releasing.md describes both.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { draftSections, formatDraft, fragmentFileName } from './lib/changelog.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fragmentsPath = join(repositoryRoot, 'changelog.d');

function git(...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function parseArguments(argv) {
  const options = { write: false, since: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      // pnpm forwards its own argument separator; node passes it straight on.
      continue;
    }

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
  process.stderr.write('Preview only; no fragment was written. Re-run with --write.\n\n');
  process.stdout.write(`${draft}\n`);
  process.exit(0);
}

await mkdir(fragmentsPath, { recursive: true });

let written = 0;
let kept = 0;

for (const [section, entries] of Object.entries(sections)) {
  for (const entry of entries) {
    const name = fragmentFileName(section, entry);
    // `wx` fails rather than overwriting, which is what keeps an entry the
    // author has already rewritten from being replaced by its commit subject.
    try {
      await writeFile(join(fragmentsPath, name), `- ${entry}\n`, { encoding: 'utf8', flag: 'wx' });
      process.stderr.write(`  changelog.d/${name}\n`);
      written += 1;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      process.stderr.write(`  changelog.d/${name} (kept, already written)\n`);
      kept += 1;
    }
  }
}

process.stderr.write(
  `Wrote ${written} fragment(s)${kept > 0 ? `, kept ${kept}` : ''}. Rewrite them in the changelog's voice before committing.\n`,
);
