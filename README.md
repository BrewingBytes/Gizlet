# Gizlet

**Small, useful tools that run in your browser.**

Gizlet is a static-first collection of focused web utilities—called *Gizlets*—for everyday image, developer, and SEO tasks. The initial product is designed to be fast, straightforward, and privacy-conscious: where a tool is marked local, its work happens in the browser rather than by uploading the user's content to a server.

The approved application architecture, toolchain, dependency policy, and Rust/WASM adoption rule are documented in [docs/architecture.md](docs/architecture.md).

The approved brand identity and UI guidance are in [design.md](design.md); reusable logo, icon, favicon, app-icon, and brand-reference assets live in `public/brand/`.

## Development

Gizlet uses Node.js 24 LTS and pnpm 10.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The standard validation commands are `pnpm run check`, `pnpm test`, and `pnpm run build`. Browser test coverage is added in the test-foundation milestone.

## Product principles

- **Useful by default.** Each Gizlet should solve one clear task without an account, a tutorial, or unnecessary setup.
- **Local processing where practical.** File and text inputs stay on the device for tools explicitly marked as local. This claim is scoped per tool; analytics and advertising requests are separate from tool processing.
- **Fast and static-first.** The initial site does not require a long-running application server.
- **Accessible and clear.** Keyboard navigation, visible focus states, semantic controls, readable contrast, and responsive layouts are launch requirements.
- **Respectful monetization.** The free site may include clearly labeled advertisements, but ads must not resemble primary actions or interfere with workflows. A future Gizlet Pro tier removes ads without changing the available tools.

## Contributing

Please start with the open issue that defines the intended work. Keep changes focused on its scope and acceptance criteria, and preserve the project principles above.

When adding a Gizlet or shared feature:

1. Prefer browser-native APIs and keep user content local whenever feasible.
2. Reuse the typed tool registry for tool names, routes, categories, and search data.
3. Add focused tests for behavior that can regress.
4. Ensure controls remain keyboard accessible and work at mobile widths.
5. Do not place ads in forms, upload areas, or next to download/primary-action controls.

## Versioning and commits

Gizlet uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

- Use a conventional commit type such as `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, or `chore`; add an optional scope when it improves clarity.
- Use `!` or a `BREAKING CHANGE:` footer for breaking changes.
- Keep [CHANGELOG.md](CHANGELOG.md) current for changes that are user- or contributor-visible.
- The project begins public releases at `0.1.0`; see the changelog for the release policy.

## Privacy and advertising

The final public privacy policy will describe the implemented behavior—not assumptions. In particular:

- Local Gizlets will state what is processed on-device.
- Analytics must never include file contents, JSON contents, generated passwords, or other user-entered tool payloads.
- Advertising and analytics can be disabled during local development.
- Any consent requirements introduced by selected providers will be documented before production enablement.

Policy pages and the finalized disclosure are tracked in [#21](https://github.com/BrewingBytes/Gizlet/issues/21), [#22](https://github.com/BrewingBytes/Gizlet/issues/22), and [#24](https://github.com/BrewingBytes/Gizlet/issues/24).

## License

Copyright 2026 BrewingBytes. Gizlet is licensed under the [Apache License 2.0](LICENSE). You may use, modify, and distribute it under that license's terms.
