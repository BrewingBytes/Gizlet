# Changelog entries

A change that is user- or contributor-visible adds its changelog entry here, as its own file, instead of editing `CHANGELOG.md`. Two pull requests then never edit the same lines, so the changelog stops being the thing that conflicts on every rebase.

## Writing one

Name the file `<section>-<slug>.md`, where the section is one of the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) headings — `added`, `changed`, `deprecated`, `removed`, `fixed`, `security` — and the slug says roughly what the entry is about:

```
changelog.d/added-image-to-pdf-preview.md
```

The file holds the entry exactly as it should read in the changelog: one or more markdown bullets, starting with `- `. Several closely related bullets can share one file; unrelated ones get their own, since the file is also what keeps two changes from colliding.

Write for a visitor, not for the git history. A commit subject explains a change to whoever is reading the code; an entry here explains what changed for the person using Gizlet, in the voice the entries in `CHANGELOG.md` already use.

`pnpm run changelog:draft -- --since origin/main --write` seeds one file per Conventional Commit on the branch. That is a starting point to rewrite, merge, and delete from — it never overwrites a file that already exists.

## What happens to them

At release time `pnpm run changelog:collect -- --write` groups every file here under its section, writes them into `CHANGELOG.md` as the new release section, and deletes them. Files within a section are ordered by file name. See [docs/releasing.md](../docs/releasing.md).
