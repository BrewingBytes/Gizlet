import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import renovate from "../../renovate.json";

/**
 * CI and Release run in the official Playwright image, which carries the
 * browsers for exactly one Playwright version (docs/ci-performance.md). If the
 * image and the lockfile disagree, the browser steps fail to launch rather than
 * test anything, so the mismatch is caught here, in seconds, with a message
 * that says which file to change.
 */

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const lockedPlaywright = () => {
  const match = read("pnpm-lock.yaml").match(/^ {2}'@playwright\/test@(\d+\.\d+\.\d+)':$/m);
  if (!match) throw new Error("pnpm-lock.yaml has no @playwright/test entry");
  return match[1];
};

const imageTags = (workflow: string) =>
  [...read(workflow).matchAll(/image: mcr\.microsoft\.com\/playwright:v(\S+)/g)].map(([, tag]) => tag);

describe.each([".github/workflows/ci.yml", ".github/workflows/release.yml"])("%s", (workflow) => {
  it("validates in the Playwright image for the locked @playwright/test version", () => {
    expect(imageTags(workflow)).toEqual([`${lockedPlaywright()}-noble`]);
  });

  it("does not install browsers the image already carries", () => {
    expect(read(workflow)).not.toMatch(/playwright install/);
  });
});

describe("Renovate", () => {
  it("updates the image and @playwright/test in one pull request", () => {
    const rule = renovate.packageRules.find((candidate) => candidate.groupName === "Playwright");
    expect(rule?.matchPackageNames).toEqual(
      expect.arrayContaining(["@playwright/test", "mcr.microsoft.com/playwright"]),
    );
  });
});
