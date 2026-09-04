/**
 * Collects the entries in changelog.d/ into one release section in
 * CHANGELOG.md.
 *
 *   pnpm run changelog:collect                       # print the section, write nothing
 *   pnpm run changelog:collect -- --write            # write it and remove the fragments
 *   pnpm run changelog:collect -- --version 0.4.0 --date 2026-09-10
 *
 * A pull request writes its entry as its own file under changelog.d/ rather
 * than editing CHANGELOG.md, so two open pull requests never touch the same
 * lines. This script is the other half of that: at release time it turns those
 * files into the `## [x.y.z] - YYYY-MM-DD` section the release tag is checked
 * against. See docs/releasing.md.
 */
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectFragments, formatRelease } from './lib/changelog.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(repositoryRoot, 'CHANGELOG.md');
const fragmentsPath = join(repositoryRoot, 'changelog.d');
const unreleasedHeading = '## [Unreleased]';

/**
 * The whole body of `## [Unreleased]`. Entries live in changelog.d/ instead, so
 * anything else under that heading is content this script would silently drop.
 */
const unreleasedBody =
  'Entries for the next release are written as files in [changelog.d/](changelog.d/), one per change. See [docs/releasing.md](docs/releasing.md).';

function parseArguments(argv) {
  const options = { write: false, version: null, date: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      // pnpm forwards its own argument separator; node passes it straight on.
      continue;
    }

    if (argument === '--write') {
      options.write = true;
    } else if (argument === '--preview' || argument === '--dry-run') {
      options.write = false;
    } else if (argument === '--version' || argument === '--date') {
      options[argument.slice(2)] = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--version=') || argument.startsWith('--date=')) {
      const [flag, value] = [argument.slice(2, argument.indexOf('=')), argument.slice(argument.indexOf('=') + 1)];
      options[flag] = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

/** Every fragment in changelog.d/, as the pure module wants them. */
async function readFragments() {
  const names = (await readdir(fragmentsPath)).filter((name) => name.endsWith('.md') && name !== 'README.md').sort();

  return Promise.all(
    names.map(async (name) => ({ name, body: await readFile(join(fragmentsPath, name), 'utf8') })),
  );
}

/**
 * Inserts the release section beneath a freshly emptied `## [Unreleased]`.
 *
 * It refuses when `## [Unreleased]` holds anything but its pointer, because
 * that content was written by hand and would otherwise be overwritten.
 */
function insertRelease(changelog, heading, release) {
  const start = changelog.indexOf(unreleasedHeading);
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no ${unreleasedHeading} section to release from.`);
  }

  const bodyStart = start + unreleasedHeading.length;
  const nextHeading = changelog.indexOf('\n## ', bodyStart);
  const bodyEnd = nextHeading === -1 ? changelog.length : nextHeading + 1;
  const body = changelog.slice(bodyStart, bodyEnd).trim();

  if (body !== unreleasedBody) {
    throw new Error(
      `${unreleasedHeading} holds entries written by hand. Move them into changelog.d/ so they are collected here, and leave the heading pointing at that directory.`,
    );
  }

  return `${changelog.slice(0, bodyStart)}\n\n${unreleasedBody}\n\n${heading}\n\n${release}\n\n${changelog.slice(bodyEnd)}`;
}

const options = parseArguments(process.argv.slice(2));
const packageVersion = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8')).version;
const version = options.version ?? packageVersion;
const date = options.date ?? new Date().toISOString().slice(0, 10);

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Not a version number: ${version}`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error(`Not a YYYY-MM-DD date: ${date}`);
}

const fragments = await readFragments();
if (fragments.length === 0) {
  process.stderr.write('changelog.d/ holds no entries, so there is nothing to release.\n');
  process.exit(1);
}

const heading = `## [${version}] - ${date}`;
const release = formatRelease(collectFragments(fragments));
const changelog = await readFile(changelogPath, 'utf8');

if (changelog.includes(`\n## [${version}]`)) {
  throw new Error(`CHANGELOG.md already has a ${version} section. Bump package.json, or pass --version.`);
}

process.stderr.write(`Collected ${fragments.length} entr${fragments.length === 1 ? 'y' : 'ies'} into ${heading}.\n`);

if (!options.write) {
  process.stderr.write('Preview only; nothing was written. Re-run with --write.\n\n');
  process.stdout.write(`${heading}\n\n${release}\n`);
  process.exit(0);
}

await writeFile(changelogPath, insertRelease(changelog, heading, release), 'utf8');
await Promise.all(fragments.map(({ name }) => rm(join(fragmentsPath, name))));
process.stderr.write('Wrote the section into CHANGELOG.md and removed the collected fragments. Review it before committing.\n');
