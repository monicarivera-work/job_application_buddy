import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../../config';

/**
 * Thin wrapper around a Playwright browser instance.
 * Provides a `run` helper that opens a new context + page, executes the callback,
 * and then tears everything down safely.
 */
export const playwrightClient = {
  async run(callback: (page: Page) => Promise<void>): Promise<void> {
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    try {
      try {
        browser = await chromium.launch({ headless: config.headless });
      } catch (err) {
        throw new Error(
          `Failed to launch Chromium browser. If browsers are not installed, run: npx playwright install chromium\n` +
          `Original error: ${(err as Error).message}`
        );
      }
      context = await browser.newContext();
      const page = await context.newPage();
      await callback(page);
    } finally {
      if (context) await context.close();
      if (browser) await browser.close();
    }
  },
};
