import { expect, test } from '@playwright/test';

import { expectAccessible } from './fixtures';
import { signUp } from './steps';

/** Narrowest description field that still shows a typical label ("Website audit, March") without scrolling. */
const MIN_DESCRIPTION_WIDTH = 200;
/** The line action buttons are 32 px squares; below this they are squeezed and hard to hit. */
const MIN_ACTION_WIDTH = 30;

/**
 * The lines grid of the invoice editor must leave room for the description and the actions at every width (#41).
 * The widths cover the layout switches: 660 to 760 px around the card / two-row boundary, 900 px where the page
 * gets wider, 1099 and 1100 px on both sides of the side panel appearing.
 */
test('the line description and actions stay usable at every desktop width', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Phones use the stacked layout, covered by the journey');
  await signUp(page);
  await page.goto('/invoices/new');
  await page.getByRole('button', { name: 'Free line' }).click();
  const line = page.getByRole('row', { name: 'Line 1' });
  const description = page.getByRole('textbox', { name: 'Line 1 description' });
  const remove = page.getByRole('button', { name: 'Remove line 1' });

  for (const width of [660, 700, 760, 900, 1024, 1099, 1100, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const descriptionBox = await description.boundingBox();
    expect(descriptionBox?.width ?? 0, `description width at ${width} px`).toBeGreaterThanOrEqual(
      MIN_DESCRIPTION_WIDTH,
    );
    // The last action button: the first to be squeezed or pushed out of the line
    const removeBox = (await remove.boundingBox())!;
    const lineBox = (await line.boundingBox())!;
    expect(removeBox.width, `action button width at ${width} px`).toBeGreaterThanOrEqual(
      MIN_ACTION_WIDTH,
    );
    expect(
      removeBox.x + removeBox.width,
      `actions inside the line at ${width} px`,
    ).toBeLessThanOrEqual(lineBox.x + lineBox.width);
  }
  await expectAccessible(page);
});
