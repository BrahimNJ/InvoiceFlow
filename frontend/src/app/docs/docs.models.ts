/** Shapes written by scripts/build-docs.mjs into public/docs. */

export interface DocsPageSummary {
  slug: string;
  title: string;
  description: string;
}

export interface DocsSection {
  title: string;
  pages: DocsPageSummary[];
}

export interface DocsHeading {
  id: string;
  text: string;
  depth: number;
}

export interface DocsPage extends DocsPageSummary {
  /** The Markdown file on GitHub. */
  source: string;
  hasDiagram: boolean;
  toc: DocsHeading[];
  /** Rendered at build time from version-controlled Markdown, never from user input. */
  html: string;
}
