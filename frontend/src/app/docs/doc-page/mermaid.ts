import { Theme } from '../../core/theme/theme.service';

/** Token → Mermaid theme variable. Mermaid derives shades itself, so only plain hex tokens are passed. */
const THEME_TOKENS: Record<string, string> = {
  background: '--surface',
  primaryColor: '--surface',
  primaryTextColor: '--ink-900',
  primaryBorderColor: '--ink-700',
  secondaryColor: '--brand-50',
  tertiaryColor: '--surface-2',
  lineColor: '--ink-500',
  textColor: '--ink-900',
  noteBkgColor: '--surface-2',
  noteBorderColor: '--line-strong',
  actorBkg: '--surface',
  actorBorder: '--ink-700',
  signalColor: '--ink-700',
  signalTextColor: '--ink-900',
};

/**
 * Renders the `<pre class="mermaid">` blocks under `root` with the current theme's colours. Mermaid (a large library)
 * is loaded only here, on the first page that has a diagram. The source is kept on each block so a theme change can
 * render it again.
 */
export async function renderDiagrams(root: HTMLElement, theme: Theme): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('pre.mermaid')];
  if (blocks.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  const style = getComputedStyle(document.documentElement);
  const themeVariables = Object.fromEntries(
    Object.entries(THEME_TOKENS).map(([name, token]) => [name, style.getPropertyValue(token).trim()]),
  );
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    darkMode: theme === 'dark',
    fontFamily: style.getPropertyValue('--font-sans'),
    themeVariables: { ...themeVariables, fontSize: '14px' },
  });

  for (const block of blocks) {
    block.dataset['source'] ??= block.textContent ?? '';
    if (block.dataset['theme'] === theme) continue;
    block.removeAttribute('data-processed');
    block.textContent = block.dataset['source'];
    block.dataset['theme'] = theme;
  }
  await mermaid.run({ nodes: blocks.filter((block) => !block.hasAttribute('data-processed')) });
}
