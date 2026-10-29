import { expect, test } from '@playwright/test';

import { expectAccessible } from './fixtures';
import { signUp } from './steps';

/** Narrowest description field that still shows a typical label ("Website audit, March") without scrolling. */
const MIN_DESCRIPTION_WIDTH = 200;

/**
 * The lines grid of the invoice editor must leave room for the description at every width (#41): 900 px is where
 * the one-row-per-line layout starts, 1100 px where the side panel appears next to it.
 */
test('the line description stays usable at every desktop width', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones use the stacked layout, covered by the journey');
  await signUp(page);
  await page.goto('/invoices/new');
  await page.getByRole('button', { name: 'Free line' }).click();
  const description = page.getByRole('textbox', { name: 'Line 1 description' });

  for (const width of [900, 1024, 1100, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await description.boundingBox();
    expect(box?.width ?? 0, `description width at ${width} px`).toBeGreaterThanOrEqual(
      MIN_DESCRIPTION_WIDTH,
    );
  }
  await expectAccessible(page);
});
