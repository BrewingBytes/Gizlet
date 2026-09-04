# The roadmap, and how it stays true

Gizlet publishes what it intends to build and what would make it stop. This document is the narrative behind that page. It deliberately contains no list: not one Gizlet's name, slug or route, and not one phase number appears below, and a Vitest case in `tests/unit/roadmap.test.ts` reads this file and fails if one does. Everything nameable lives in typed data, so there is exactly one place a reader can be told something false.

## What a phase is

A phase is an **order of work**, not a schedule. It answers "what comes next, and why that rather than the thing with more search volume" — and the answer is almost always shared machinery: a phase goes ahead of another because it reuses something that already exists, or because it builds the piece the next phase needs.

There are no dates anywhere in the data, and the rendered page carries no timeline, connector, dot or gantt. Those shapes are the problem rather than the presentation of it: each one implies a date the project does not have, and a reader who infers one has been misled by the layout rather than by the prose. A phase's "when" is a dependency, and the only status a phase carries is that it is behind us, next, or later.

Each phase fills in the same short form, in the same order, every time: when, what, what it reuses, the signal, and the condition under which it stops. A phase that has already shipped adds where it stands, judged in the past tense. The repetition is the point — two phases are comparable because a reader can read the same line twice instead of trusting two differently shaped paragraphs.

## Where the data lives

- **`src/data/tools.ts`** is the source of every name, slug, route and category. A registry entry is either available, with an implementation behind it and an agent-facing description, or planned, with neither. The two are a discriminated union, so a planned entry cannot carry a locality claim about processing that does not exist yet, and the compiler keeps that rather than a convention keeping it.
- **`src/data/roadmap.ts`** holds the phases, the chains, and the refusals. A phase names slugs and nothing else about a Gizlet; the page reads the names and routes back out of the registry every time it renders one. That is the whole anti-drift mechanism: the roadmap cannot disagree with the registry, because it does not repeat it.
- **`src/pages/roadmap.astro`** renders the page and **`src/components/NotBuiltYet.astro`** renders the bench on the Gizlet index. Neither holds a list of its own.
- **This file** holds the reasoning, and no list at all.

A planned entry also reaches the machine-readable catalogue and the plain-text discovery document, under a separate key and a separate heading. The shape there omits locality, input, output and the privacy sentence rather than publishing an empty or false value for each: a reader is never asked to work out that a key name means "do not call this", because the fields that would let it be called are simply absent.

## How a phase is judged

Every phase carries a signal and a kill criterion, and both are constrained by what this architecture can actually observe. Read [signals.md](signals.md) before writing either. The short version: a pageview and a filed issue are countable, and almost nothing else is. There are no custom events, no query strings in the logs, no completion or error rates, and nothing older than about thirty days. A criterion written in terms of clicks, downloads or completions is not a strict criterion — it is an unevaluable one, and it is only discovered to be unevaluable at the moment someone tries to evaluate it.

The kill criterion is not a formality. It states the condition under which the work does not happen, in the flattest language the voice guide allows: [design.md](../design.md) forbids humour in a kill-criterion line and in the refusal table, because wit inside a sentence about stopping reads as a pre-emptive apology for the decision. These are the lines a reader tests the whole product's honesty against.

## What Gizlet won't build

The page ends with a table of refusals, and every row carries somewhere else to go. That is deliberate: each refusal is traffic that could never have converted, because the job genuinely cannot be done honestly in a browser tab, and handing it to whoever does do it is what makes the refusal read as technical rather than commercial. Two of the rows point at software that runs on the reader's own machine, which is the same argument this site makes about itself.

The rule the table closes on is the one that generates it: if it needs a server, it isn't a Gizlet.

## Closing a tool issue

A Gizlet becoming real is a change to the roadmap, and it happens in the same pull request. `AGENTS.md` states the rule; the reason is that any other order leaves the site briefly lying. A registry entry that flips to available gains an agent-facing description, a flow contract or a declared exemption, a related-tools key and a social card, and its phase records it as shipped. Nothing about the bench is a separate follow-up: a Gizlet that works and a page that says it does not are the same defect this whole design exists to prevent.
