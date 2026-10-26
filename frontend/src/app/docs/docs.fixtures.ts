import { DocsPage, DocsSection } from './docs.models';

export const SECTIONS: DocsSection[] = [
  { title: 'Start here', pages: [{ slug: 'overview', title: 'Overview', description: 'What InvoiceFlow is.' }] },
  {
    title: 'Security',
    pages: [
      { slug: 'security', title: 'Security', description: 'The threat model.' },
      { slug: 'authentication', title: 'Authentication', description: 'Tokens and sessions.' },
    ],
  },
];

export function docsPage(overrides: Partial<DocsPage> = {}): DocsPage {
  return {
    slug: 'security',
    title: 'Security',
    description: 'The threat model.',
    source: 'https://github.com/BrahimNJ/InvoiceFlow/blob/main/docs/security.md',
    hasDiagram: false,
    toc: [
      { id: 'threat-model', text: 'Threat model', depth: 2 },
      { id: 'known-limits', text: 'Known limits', depth: 2 },
    ],
    html:
      '<h1>Security</h1><p>See <a href="/docs/authentication">Authentication</a> and ' +
      '<a href="#known-limits">the limits</a>.</p><h2 id="threat-model">Threat model</h2>' +
      '<h2 id="known-limits">Known limits</h2>',
    ...overrides,
  };
}
