/**
 * Publishes pull-request screenshots to the `pr-assets` orphan branch and
 * prints the markdown that embeds them.
 *
 *   pnpm run pr:assets -- before.png after.png             # this branch's PR
 *   pnpm run pr:assets -- --pr 138 before.png after.png    # a named PR
 *   pnpm run pr:assets -- --dry-run before.png after.png   # plan only, no push
 *
 * A pull request that changes what a visitor sees has to show it, and those
 * images belong to the pull request rather than to the repository — never to
 * `main` and never to the change's own diff. Dragging the files into the
 * description is the simplest route for a human; this is the route for a tool
 * with no browser session, and it exists so that route is one command rather
 * than a dozen plumbing calls rediscovered each time. AGENTS.md describes the
 * policy the script implements.
 *
 * Nothing is checked out and no branch is switched: the files are written
 * straight into the object database, assembled into a tree with a temporary
 * index, and committed on top of whatever `origin/pr-assets` already holds, so
 * another pull request's directory survives and the working tree is untouched.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The branch is images only, so anything else is refused rather than pushed. */
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);
const assetBranch = 'pr-assets';
/** GitHub rejects a file this size in a raw request, and a screenshot never is. */
const maximumFileSize = 10 * 1024 * 1024;

function git(args, { env } = {}) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: env ? { ...process.env, ...env } : process.env,
  }).trim();
}

function parseArguments(argv) {
  const options = { pullRequest: null, files: [], push: true };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--') {
      // pnpm forwards its own argument separator; node passes it straight on.
      continue;
    }

    if (argument === '--pr') {
      options.pullRequest = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--pr=')) {
      options.pullRequest = argument.slice('--pr='.length);
    } else if (argument === '--dry-run' || argument === '--preview') {
      options.push = false;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`);
    } else {
      options.files.push(argument);
    }
  }

  return options;
}

/** `owner/name`, read from the remote rather than asked for on the command line. */
function repositorySlug() {
  const url = git(['remote', 'get-url', 'origin']);
  const match = /(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);

  if (!match) throw new Error(`Could not read a GitHub repository from origin: ${url}`);

  return match[1];
}

/** The open pull request for the current branch, so the caller need not say. */
function currentPullRequest() {
  try {
    const view = execFileSync('gh', ['pr', 'view', '--json', 'number'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return String(JSON.parse(view).number);
  } catch {
    throw new Error(
      'Could not find a pull request for this branch. Open it first, or pass --pr <number>.',
    );
  }
}

function checkFile(path) {
  const extension = extname(path).toLowerCase();

  if (!imageExtensions.has(extension)) {
    throw new Error(
      `${path} is not an image. The ${assetBranch} branch holds nothing but images.`,
    );
  }

  const { size } = statSync(path);

  if (size > maximumFileSize) {
    throw new Error(`${path} is ${(size / 1024 / 1024).toFixed(1)} MB, over the 10 MB limit.`);
  }
}

/** The remote tip of the asset branch, or null the first time one is published. */
function remoteAssetCommit() {
  const listing = git(['ls-remote', 'origin', `refs/heads/${assetBranch}`]);

  if (listing === '') return null;

  const [commit] = listing.split(/\s+/);
  // The objects have to be local before the tree can be read or extended.
  git(['fetch', 'origin', `refs/heads/${assetBranch}`]);

  return commit;
}

function publish(options) {
  for (const file of options.files) checkFile(file);

  const slug = repositorySlug();
  const pullRequest = options.pullRequest ?? currentPullRequest();

  if (!/^\d+$/.test(pullRequest)) {
    throw new Error(`A pull request is a number, not: ${pullRequest}`);
  }

  const parent = remoteAssetCommit();
  const indexDirectory = mkdtempSync(join(tmpdir(), 'gizlet-pr-assets-'));
  const env = { GIT_INDEX_FILE: join(indexDirectory, 'index') };
  const published = [];

  try {
    // Starting from what the branch already holds is what keeps this publish
    // additive: another pull request's directory is carried forward untouched,
    // and the push is an ordinary fast-forward rather than a replacement.
    if (parent) git(['read-tree', parent], { env });

    for (const file of options.files) {
      const blob = git(['hash-object', '-w', '--', file]);
      const path = `pr/${pullRequest}/${basename(file)}`;

      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
      published.push(path);
    }

    const tree = git(['write-tree'], { env });
    const message = `chore(pr-assets): screenshots for pull request ${pullRequest}`;
    const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message]);

    if (options.push) {
      git(['push', 'origin', `${commit}:refs/heads/${assetBranch}`]);
      process.stderr.write(`Pushed ${published.length} image(s) to ${assetBranch}.\n`);
    } else {
      process.stderr.write(`Dry run: built ${commit} but pushed nothing.\n`);
    }
  } finally {
    rmSync(indexDirectory, { recursive: true, force: true });
  }

  // The markdown, ready to paste into the description. The alt text is the file
  // name because only the author knows what the image shows: rewrite it there.
  process.stderr.write('\n');

  for (const path of published) {
    const url = `https://raw.githubusercontent.com/${slug}/${assetBranch}/${path}`;
    process.stdout.write(`![${basename(path, extname(path))}](${url})\n`);
  }
}

// Every refusal here is something the caller can fix — a file that is not an
// image, no pull request to attach it to — so it reads as one line rather than
// as a stack trace.
try {
  const options = parseArguments(process.argv.slice(2));

  if (options.files.length === 0) {
    throw new Error('Usage: pnpm run pr:assets -- [--pr <number>] [--dry-run] <image>…');
  }

  publish(options);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
