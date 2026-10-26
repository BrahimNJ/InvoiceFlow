# 0007. Documentation rendered from the repository at build time

- Status: accepted
- Date: 2026-10-26

## Context and problem

The project's documentation (architecture, security, decisions) should be readable by visitors of the live app,
not only on GitHub, without writing it twice and without slowing the app down.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Separate docs site (Docusaurus, VitePress) | Rich features | A second site, stack and deployment |
| Render Markdown in the browser (`ngx-markdown`) | Simple | Ships a Markdown parser and a highlighter to every visitor |
| **Render at build time into JSON pages the app fetches** | One source (`docs/`), no parser or highlighter in the browser | A small build script to maintain |

## Decision

`frontend/scripts/build-docs.mjs` runs before every build and dev server start. It renders `docs/**/*.md` with
**marked** (GitHub-flavoured Markdown), highlights code with **Shiki** (VS Code's TextMate grammars, light and dark
themes emitted as CSS variables), rewrites links (another page → `/docs/<slug>`, any other repository file → GitHub)
and writes one JSON file per page plus a navigation index to `public/docs`. **Mermaid** diagrams stay as source and
are rendered in the browser, loaded only on pages that contain one.

## Consequences

- The same Markdown files are the GitHub docs and the in-app docs.
- The browser downloads neither marked nor Shiki; Mermaid (large) is a lazy chunk.
- The HTML is inserted with `bypassSecurityTrustHtml`, because Angular's sanitizer strips the inline colour
  variables of highlighted code. This is acceptable only because the content comes from version-controlled files at
  build time and never from user input ([Security](../security.md)).
