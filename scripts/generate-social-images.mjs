/**
 * Draws the 1200x630 social preview cards committed under public/brand/social/.
 *
 * Run it by hand after changing the registry, the card treatment, or a Gizlet
 * name, then commit the PNGs it writes:
 *
 *   node scripts/generate-social-images.mjs
 *
 * Nothing in the build depends on this script. It renders the cards in the
 * Chromium that Playwright already installs, so the copy on every card comes
 * from the canonical registry instead of being retyped into an image editor.
 * It needs the system Georgia and Arial faces the site itself asks for, which
 * is why the rendered PNGs are committed rather than generated in CI.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { homePageDescription } from '../src/data/home-page.ts';
import { getBespokeSocialImageSlugs, getSocialImageFileName } from '../src/data/social-images.ts';
import {
  getAvailableTools,
  getToolCategoryGroups,
  toolCategoryLabels,
  toolRegistry,
} from '../src/data/tools.ts';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(repositoryRoot, 'public', 'brand', 'social');
const width = 1200;
const height = 630;

const palette = {
  amber: '#f6a500',
  ink: '#0f172a',
  paper: '#f3efe6',
  slate: '#6f685e',
  soft: '#e7dfd2',
  green: '#257a4e',
};

const icon = await readFile(join(repositoryRoot, 'public', 'brand', 'gizlet-icon.svg'), 'utf8');

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);
}

function toolNumber(tool) {
  return String(tool.id).padStart(3, '0');
}

/** The shared card frame: brand row at the top, footer rule at the bottom. */
function card({ stamp, body, footer, bodyClass = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    display: flex;
    flex-direction: column;
    padding: 64px 72px 56px;
    border-top: 14px solid ${palette.amber};
    background: ${palette.paper};
    color: ${palette.ink};
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .brand { display: flex; align-items: center; justify-content: space-between; }
  .brand__mark { display: flex; align-items: center; gap: 20px; }
  .brand__mark svg { width: 68px; height: 68px; display: block; }
  .brand__name { font-family: Georgia, "Times New Roman", serif; font-size: 46px; font-weight: 700; letter-spacing: -0.01em; }
  .stamp {
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 22px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${palette.slate};
  }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
  h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 92px;
    line-height: 1.02;
    letter-spacing: -0.02em;
  }
  h1.is-long { font-size: 76px; }
  .body.is-index { padding: 24px 0 0; }
  .is-index h1 { font-size: 58px; }
  .is-home h1 { font-size: 78px; }
  .is-home .lede { max-width: 940px; }
  .lede { max-width: 900px; margin-top: 28px; font-size: 34px; line-height: 1.35; color: ${palette.slate}; }
  .rows { margin-top: 24px; display: grid; gap: 0; max-width: 940px; }
  .rows div {
    display: flex;
    gap: 28px;
    align-items: baseline;
    padding: 9px 0;
    border-top: 1px solid ${palette.soft};
    font-size: 26px;
  }
  .rows span:first-child {
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 24px;
    color: ${palette.slate};
  }
  .rows strong { font-family: Georgia, "Times New Roman", serif; font-weight: 700; }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    padding-top: 28px;
    border-top: 2px solid ${palette.ink};
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 24px;
    color: ${palette.slate};
  }
  .local { display: flex; align-items: center; gap: 12px; color: ${palette.green}; letter-spacing: 0.12em; text-transform: uppercase; }
  .local::before { content: ""; width: 14px; height: 14px; border-radius: 50%; background: ${palette.green}; }
</style>
</head>
<body>
  <div class="brand">
    <div class="brand__mark">${icon}<span class="brand__name">gizlet</span></div>
    <p class="stamp">${stamp}</p>
  </div>
  <div class="body${bodyClass}">${body}</div>
  <footer>${footer}</footer>
</body>
</html>`;
}

function toolCard(tool) {
  const heading = escapeHtml(tool.name);
  const headingClass = tool.name.length > 16 ? ' class="is-long"' : '';

  return card({
    stamp: `${toolNumber(tool)} &middot; ${escapeHtml(toolCategoryLabels[tool.category])}`,
    body: `<h1${headingClass}>${heading}</h1><p class="lede">${escapeHtml(tool.description)}</p>`,
    footer: `<span>gizlet.app${escapeHtml(tool.path.replace(/\/$/, ''))}</span>${
      tool.processesLocally ? '<span class="local">Local processing</span>' : ''
    }`,
  });
}

/**
 * The home page's card. Its stamp is the live category list, so it can never
 * advertise a kind of Gizlet the registry does not have.
 */
function homeCard(tools) {
  const categories = getToolCategoryGroups()
    .map((group) => escapeHtml(group.label))
    .join(' &middot; ');

  return card({
    stamp: categories,
    bodyClass: ' is-home',
    body: `<h1>Useful internet things,<br />without the nonsense.</h1><p class="lede">${escapeHtml(homePageDescription)}</p>`,
    footer: `<span>gizlet.app</span>${
      tools.every((tool) => tool.processesLocally) ? '<span class="local">Local processing</span>' : ''
    }`,
  });
}

function indexCard(tools) {
  const rows = tools
    .map(
      (tool) =>
        `<div><span>${toolNumber(tool)}</span><strong>${escapeHtml(tool.name)}</strong></div>`,
    )
    .join('');

  return card({
    stamp: `${tools.length} Gizlets`,
    bodyClass: ' is-index',
    body: `<h1>A little tool for everything.</h1><div class="rows">${rows}</div>`,
    footer: `<span>gizlet.app/tools</span>${
      tools.every((tool) => tool.processesLocally) ? '<span class="local">Local processing</span>' : ''
    }`,
  });
}

const bespokeSlugs = new Set(getBespokeSocialImageSlugs());
const tools = toolRegistry.filter((tool) => bespokeSlugs.has(tool.slug));
const missing = [...bespokeSlugs].filter((slug) => !tools.some((tool) => tool.slug === slug));

if (missing.length > 0) {
  throw new Error(`No registry entry for social image slug: ${missing.join(', ')}`);
}

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

const cards = [
  ...tools.map((tool) => ({ fileName: getSocialImageFileName(tool.slug), html: toolCard(tool) })),
  { fileName: 'gizlets.png', html: indexCard(getAvailableTools()) },
  { fileName: 'home.png', html: homeCard(getAvailableTools()) },
];

for (const { fileName, html } of cards) {
  await page.setContent(html, { waitUntil: 'load' });
  const image = await page.screenshot({ type: 'png' });
  await writeFile(join(outputDirectory, fileName), image);
  console.log(`${fileName} ${(image.byteLength / 1024).toFixed(1)} KB`);
}

await browser.close();
