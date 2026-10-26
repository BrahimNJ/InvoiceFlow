// Renders the repository's Markdown documentation (../docs) into JSON pages served by the app at /docs.
// Runs before `ng build` / `ng serve` (npm pre-scripts). Highlighting happens here, at build time, so the browser
// downloads neither Shiki nor grammars; only Mermaid diagrams are rendered client-side, on the pages that have them.
//
// The output lands in public/docs (git-ignored): one index.json for the navigation, one <slug>.json per page.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import GithubSlugger from 'github-slugger';
import { Marked } from 'marked';
import { createHighlighter } from 'shiki';

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(FRONTEND, '..');
const DOCS = join(REPO, 'docs');
const OUT = join(FRONTEND, 'public', 'docs');
const SOURCE_URL = 'https://github.com/BrahimNJ/InvoiceFlow/blob/main/';

/** Navigation order. Paths are relative to docs/; ADRs are discovered from docs/adr. */
const SECTIONS = [
  { title: 'Start here', pages: ['overview.md'] },
  { title: 'Product', pages: ['invoicing.md'] },
  { title: 'Architecture', pages: ['architecture.md'] },
  { title: 'Security', pages: ['security.md', 'authentication.md'] },
  { title: 'Quality', pages: ['testing.md'] },
  { title: 'Operations', pages: ['deployment.md'] },
  {
    title: 'Decisions',
    pages: [
      'adr/README.md',
      ...readdirSync(join(DOCS, 'adr'))
        .filter((file) => /^\d{4}-.+\.md$/.test(file))
        .sort()
        .map((file) => `adr/${file}`),
    ],
  },
  { title: 'Workflow', pages: ['claude-code/agents.md', 'claude-code/best-practices.md'] },
];

const LANGUAGES = ['java', 'typescript', 'javascript', 'json', 'yaml', 'bash', 'sql', 'html', 'css', 'properties', 'xml', 'text'];

/** `adr/0001-modular-monolith.md` → `adr-0001-modular-monolith`; README pages take their folder name. */
function slugOf(path) {
  return path.replace(/\/README\.md$/, '').replace(/\.md$/, '').replaceAll('/', '-').toLowerCase();
}

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const pagePaths = SECTIONS.flatMap((section) => section.pages);
const slugByPath = new Map(pagePaths.map((path) => [path, slugOf(path)]));

/**
 * Where a link written in docs/<from> should point on the site: another rendered page stays in the app,
 * any other repository file opens on GitHub, absolute URLs and anchors are kept.
 */
function resolveLink(href, from) {
  if (/^([a-z]+:|#|\/\/)/i.test(href)) return { href, external: /^https?:/i.test(href) };
  const [path, hash] = href.split('#');
  const target = posix.normalize(posix.join(posix.dirname(from), path));
  const slug = slugByPath.get(target) ?? slugByPath.get(posix.join(target, 'README.md'));
  if (slug) return { href: `/docs/${slug}${hash ? `#${hash}` : ''}`, external: false };
  const repoPath = posix.normalize(posix.join('docs', target));
  return { href: SOURCE_URL + repoPath + (hash ? `#${hash}` : ''), external: true };
}

/** First prose paragraph (lines joined), for the navigation and the page meta description. */
function descriptionOf(markdown) {
  const paragraph = markdown
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/\s*\r?\n\s*/g, ' ').trim())
    .find((block) => block && !/^[#>|<`-]/.test(block));
  // Markdown links keep their text; emphasis and code marks are dropped.
  return (paragraph ?? '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').slice(0, 220);
}

const highlighter = await createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGUAGES });

function render(path) {
  const markdown = readFileSync(join(DOCS, path), 'utf8');
  const slugger = new GithubSlugger();
  const toc = [];
  let title = null;
  let hasDiagram = false;

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const content = this.parser.parseInline(tokens);
        if (depth === 1) {
          title ??= text;
          return `<h1>${content}</h1>\n`;
        }
        const id = slugger.slug(text);
        if (depth <= 3) toc.push({ id, text: text.replace(/`/g, ''), depth });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${content}</h${depth}>\n`;
      },
      code({ text, lang }) {
        if (lang === 'mermaid') {
          hasDiagram = true;
          return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
        }
        const language = LANGUAGES.includes(lang) ? lang : 'text';
        // Dual themes as CSS variables: the page picks light or dark with [data-theme], no re-highlighting.
        return highlighter.codeToHtml(text, {
          lang: language,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        });
      },
      link({ href, title: linkTitle, tokens }) {
        const target = resolveLink(href, path);
        const attrs = target.external ? ' target="_blank" rel="noopener"' : '';
        const titleAttr = linkTitle ? ` title="${escapeHtml(linkTitle)}"` : '';
        return `<a href="${escapeHtml(target.href)}"${titleAttr}${attrs}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
    hooks: {
      // Wide tables scroll inside their own box instead of widening the page on phones.
      postprocess: (html) =>
        html.replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>'),
    },
  });

  const html = marked.parse(markdown);
  // ADRs open with a status list: their summary is the first paragraph of their context instead.
  const body = markdown.replace(/^- (Status|Date):.*$/gm, '');
  return {
    slug: slugByPath.get(path),
    title: title ?? path,
    description: descriptionOf(body),
    source: SOURCE_URL + 'docs/' + path,
    hasDiagram,
    toc,
    html,
  };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const index = SECTIONS.map((section) => ({
  title: section.title,
  pages: section.pages.map((path) => {
    const page = render(path);
    writeFileSync(join(OUT, `${page.slug}.json`), JSON.stringify(page));
    return { slug: page.slug, title: page.title, description: page.description };
  }),
}));
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));

console.log(`docs: ${pagePaths.length} pages rendered to ${relative(FRONTEND, OUT)}`);
