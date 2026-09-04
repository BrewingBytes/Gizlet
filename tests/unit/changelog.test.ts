import { describe, expect, it } from "vitest";

import {
  changelogSectionFor,
  changelogSections,
  collectFragments,
  draftSections,
  formatDraft,
  formatEntry,
  formatRelease,
  fragmentFileName,
  parseCommitTitle,
  parseFragmentName,
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
    expect(changelogSections).toEqual([
      "Added",
      "Changed",
      "Deprecated",
      "Removed",
      "Fixed",
      "Security",
    ]);
  });
});

describe("fragment names", () => {
  it("reads the section and the slug", () => {
    expect(parseFragmentName("added-image-to-pdf-preview.md")).toEqual({
      section: "Added",
      slug: "image-to-pdf-preview",
    });
    expect(parseFragmentName("security-csp-report-only.md")?.section).toBe("Security");
  });

  it("rejects a name the collector cannot place", () => {
    expect(parseFragmentName("improved-something.md")).toBeNull();
    expect(parseFragmentName("added.md")).toBeNull();
    expect(parseFragmentName("Added-Thing.md")).toBeNull();
    expect(parseFragmentName("added-thing.txt")).toBeNull();
    expect(parseFragmentName("README.md")).toBeNull();
  });

  it("builds a short kebab-case name from an entry", () => {
    expect(fragmentFileName("Fixed", "Keep the wordmark visible on dark backgrounds.")).toBe(
      "fixed-keep-the-wordmark-visible-on-dark.md",
    );
    expect(fragmentFileName("Added", "Add a `pdf-file` payload kind")).toBe(
      "added-add-a-pdf-file-payload-kind.md",
    );
  });

  it("names a file even when nothing in the entry survives slugging", () => {
    expect(fragmentFileName("Changed", "!!!")).toBe("changed-entry.md");
  });

  it("round-trips a drafted name back to its section", () => {
    expect(parseFragmentName(fragmentFileName("Changed", "Rename JPG to PDF"))?.section).toBe(
      "Changed",
    );
  });
});

describe("collecting fragments", () => {
  const fragments = [
    { name: "fixed-wordmark.md", body: "- Keep the wordmark visible.\n" },
    { name: "added-json-formatter.md", body: "- A local JSON formatter.\n" },
    { name: "added-a-pdf-viewer.md", body: "- A PDF Viewer Gizlet.\n" },
  ];

  it("groups fragments into sections, ordered by file name", () => {
    expect(collectFragments(fragments)).toEqual({
      Added: ["- A PDF Viewer Gizlet.", "- A local JSON formatter."],
      Fixed: ["- Keep the wordmark visible."],
    });
  });

  it("keeps a multi-bullet fragment as one block, as written", () => {
    const body = "- First bullet.\n- Second bullet, same change.\n";
    expect(collectFragments([{ name: "changed-two.md", body }]).Changed).toEqual([
      "- First bullet.\n- Second bullet, same change.",
    ]);
  });

  it("reports every unreadable fragment at once", () => {
    expect(() =>
      collectFragments([
        { name: "improved-thing.md", body: "- Something." },
        { name: "added-empty.md", body: "\n" },
        { name: "fixed-prose.md", body: "Not a bullet." },
      ]),
    ).toThrow(/3 fragment\(s\)[\s\S]*added-empty[\s\S]*fixed-prose[\s\S]*improved-thing/);
  });

  it("collects nothing from no fragments", () => {
    expect(collectFragments([])).toEqual({});
    expect(formatRelease({})).toBe("");
  });

  it("renders a release section in changelog order", () => {
    expect(formatRelease(collectFragments(fragments))).toBe(
      [
        "### Added",
        "",
        "- A PDF Viewer Gizlet.",
        "- A local JSON formatter.",
        "",
        "### Fixed",
        "",
        "- Keep the wordmark visible.",
      ].join("\n"),
    );
  });
});
