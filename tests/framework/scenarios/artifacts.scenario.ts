import { expect, type Page } from '@playwright/test';
import { test } from '../../../framework/fixtures/core.ts';

/** A page that produces one console error, one page error and one failed request, all leaking a token. */
async function noisyPage(page: Page): Promise<void> {
  const events = Promise.all([page.waitForEvent('pageerror'), page.waitForEvent('requestfailed')]);
  await page.setContent(`
    <h1>Diagnostics probe</h1>
    <p>secret in markup: token=markup-leak-123</p>
    <script>
      console.error('console says token=console-leak-123');
      setTimeout(() => { throw new Error('page error with token=pageerror-leak-123'); });
      fetch('http://127.0.0.1:9/unreachable?token=request-leak-123').catch(() => {});
    </script>`);
  await expect(page.getByRole('heading', { name: 'Diagnostics probe' })).toBeVisible();
  await events;
}

test('failing UI test', async ({ page }) => {
  await noisyPage(page);
  await expect(page.getByText('never rendered'), 'intentional UI failure').toBeVisible({
    timeout: 500,
  });
});

test('passing UI test', async ({ page }) => {
  await noisyPage(page);
});

test('closed page still yields the remaining artifacts', async ({ page }) => {
  await noisyPage(page);
  await page.close();
  expect(page.isClosed(), 'intentional failure after closing the page').toBe(false);
});
