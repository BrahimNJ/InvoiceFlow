import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';

/** WCAG 2.1 levels A and AA, the target stated in docs/testing.md. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Runs axe-core on the page as it is now and fails with a readable list of the violations. */
export async function expectAccessible(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .map((node) => `    ${node.target.join(' ')}: ${node.failureSummary?.replace(/\s+/g, ' ')}`)
        .join('\n'),
  );
  expect(summary, `axe-core violations on ${page.url()}`).toEqual([]);
}

/** A new account per test, so tests share no data and can run in parallel. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
