import { describe, expect, it } from "vitest";

import {
  changelogSectionFor,
  changelogSections,
  draftSections,
  formatDraft,
  formatEntry,
  parseCommitTitle,
} from "../../scripts/lib/changelog.mjs";

describe("commit title parsing", () => {
  it("reads the type, scope, and description", () => {
    expect(parseCommitTitle("fix(json): retain invalid input")).toEqual({
      type: "fix",
      scope: "json",
      breaking: false,
      description: "retain invalid input",
    });
  });

  it("treats a missing scope as absent rather than empty", () => {
    expect(parseCommitTitle("feat: add image resize tool")).toEqual({
      type: "feat",
      scope: null,
      breaking: false,
      description: "add image resize tool",
    });
  });

  it("marks a bang as breaking, with or without a scope", () => {
    expect(parseCommitTitle("feat!: drop Node 22")?.breaking).toBe(true);
    expect(parseCommitTitle("refactor(build)!: move the output directory")?.breaking).toBe(true);
  });

  it("drops the pull request number a squash merge appends", () => {
    expect(parseCommitTitle("feat(seo): add per-Gizlet social cards (#66)")?.description).toBe(
      "add per-Gizlet social cards",
    );
  });

  it("rejects anything that is not a Conventional Commit subject", () => {
    expect(parseCommitTitle("Merge pull request #66 from BrewingBytes/feat")).toBeNull();
    expect(parseCommitTitle("Feat: capitalised type")).toBeNull();
    expect(parseCommitTitle("feat add resize tool")).toBeNull();
    expect(parseCommitTitle("feat: ")).toBeNull();
  });
});

describe("section mapping", () => {
  it("maps features to Added and fixes to Fixed", () => {
    expect(changelogSectionFor({ type: "feat", breaking: false })).toBe("Added");
    expect(changelogSectionFor({ type: "fix", breaking: false })).toBe("Fixed");
  });

  it("maps externally visible maintenance to Changed", () => {
    expect(changelogSectionFor({ type: "perf", breaking: false })).toBe("Changed");
    expect(changelogSectionFor({ type: "docs", breaking: false })).toBe("Changed");
    expect(changelogSectionFor({ type: "revert", breaking: false })).toBe("Changed");
  });

  it("omits internal maintenance that has no external impact", () => {
    for (const type of ["refactor", "build", "chore", "ci", "style", "test"]) {
      expect(changelogSectionFor({ type, breaking: false })).toBeNull();
    }
  });

  it("keeps a breaking change even when its type is otherwise omitted", () => {
    expect(changelogSectionFor({ type: "chore", breaking: true })).toBe("Changed");
    expect(changelogSectionFor({ type: "feat", breaking: true })).toBe("Added");
  });

  it("omits an unknown type", () => {
    expect(changelogSectionFor({ type: "wip", breaking: false })).toBeNull();
  });
});

describe("entry formatting", () => {
  it("writes the description as a sentence", () => {
    expect(formatEntry({ breaking: false, description: "add image resize tool" })).toBe(
      "Add image resize tool.",
    );
  });

  it("does not add a second terminator", () => {
    expect(formatEntry({ breaking: false, description: "does it work?" })).toBe("Does it work?");
  });

  it("labels a breaking change", () => {
    expect(formatEntry({ breaking: true, description: "drop Node 22" })).toBe(
      "**Breaking:** Drop Node 22.",
    );
  });
});

describe("drafting a release", () => {
  const titles = [
    "chore(deps): update astro",
    "fix(theme): keep the wordmark visible",
    "docs: record the release workflow",
    "feat: add local JSON formatter",
  ];

  it("groups commits into their sections", () => {
    expect(draftSections(titles)).toEqual({
      Added: ["Add local JSON formatter."],
      Changed: ["Record the release workflow."],
      Fixed: ["Keep the wordmark visible."],
    });
  });

  it("orders entries oldest first, reversing git log order", () => {
    expect(draftSections(["feat: second", "feat: first"]).Added).toEqual(["First.", "Second."]);
  });

  it("collapses a duplicated entry", () => {
    expect(draftSections(["fix: keep the 404 status", "fix: keep the 404 status"]).Fixed).toEqual([
      "Keep the 404 status.",
    ]);
  });

  it("returns no section when nothing is worth an entry", () => {
    expect(draftSections(["chore: tidy", "ci: cache pnpm"])).toEqual({});
    expect(formatDraft({})).toBe("");
  });

  it("renders sections in changelog order", () => {
    expect(formatDraft(draftSections(titles))).toBe(
      [
        "### Added",
        "",
        "- Add local JSON formatter.",
        "",
        "### Changed",
        "",
        "- Record the release workflow.",
        "",
        "### Fixed",
        "",
        "- Keep the wordmark visible.",
      ].join("\n"),
    );
    expect(changelogSections).toEqual(["Added", "Changed", "Fixed"]);
  });
});
