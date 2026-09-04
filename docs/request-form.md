# Gizlet request form delivery

The request form at `/request-a-gizlet/` uses GitHub Issues as its approved delivery mechanism. This is a deliberate static-site handoff, not a Gizlet form endpoint or a third-party form service.

## How it works

1. If the visitor arrived from a row in the not-built block, browser-side code prefills the tool-idea field with that Gizlet's name and says so on the page.
2. Browser-side code validates the required tool-idea field.
3. It creates a pre-filled new-issue URL for the public `BrewingBytes/Gizlet` repository.
4. The visitor reviews the draft on GitHub and explicitly submits it there.

## Arriving from a planned Gizlet

Each not-built row on `/tools/` links here with a `gizlet` query parameter naming that Gizlet's slug. The page is one prerendered document — `output: "static"` — so nothing about which row was clicked can be known in Astro frontmatter; `src/scripts/gizlet-request.ts` reads `location.search` in the browser instead.

**The parameter is resolved against `getPlannedTools()` and an unrecognised value is ignored.** That is a security boundary rather than a convenience. The prefill ends up in an issue the visitor files under their own name, so echoing an arbitrary parameter back would let a crafted link put an attacker's text into a stranger's public issue. Only a slug the registry actually carries resolves, and the field is then filled from the registry entry's name rather than from the parameter, so nothing the link carries reaches the issue.

A resolved arrival prefills the field because `validateGizletRequest` rejects anything under three characters: without the prefill there is no one-click vote at all. It also takes a fixed issue title, `Planned Gizlet: <name>`, because the title is what makes demand countable — reading the issue list is the only instrument this project has, and a title search is a count where parsing issue bodies is a chore nobody will do. The vote holds only while the idea field still says what the row said: once the visitor rewrites it, the request becomes their own and is titled as one.

The `gizlet` parameter never leaves the visitor's browser. It arrives in the URL of a page that is already built and is read by browser-side code; no request carries it anywhere, and Cloudflare Web Analytics does not log URL query strings, so it is not recorded either. See [privacy.md](privacy.md).

Gizlet does not receive, store, or transmit request-form values. The form does not set an HTTP `action`, make a fetch request, or send analytics events containing the idea, use case, or contact information. Once a visitor continues to GitHub, any information they submit is handled by GitHub under [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement).

The page says “Your request is ready” rather than claiming that Gizlet received it: GitHub is the final submission step. This preserves the static-only architecture while keeping the delivery boundary and completion state truthful.
