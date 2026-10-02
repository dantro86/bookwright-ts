import { test as core } from './core.ts';
import { loadSauceDemoConfig, type SauceDemoConfig } from '../ui/saucedemo/config.ts';
import {
  CartPage,
  CheckoutCompletePage,
  CheckoutInformationPage,
  CheckoutOverviewPage,
} from '../ui/saucedemo/checkout/checkout-pages.ts';
import { InventoryPage } from '../ui/saucedemo/inventory/inventory-page.ts';
import { LoginPage } from '../ui/saucedemo/login/login-page.ts';

/** Sauce Demo access point: page objects grouped by domain, all bound to the test's page. */
export interface SauceDemoUi {
  readonly login: LoginPage;
  readonly inventory: InventoryPage;
  readonly checkout: {
    readonly cart: CartPage;
    readonly information: CheckoutInformationPage;
    readonly overview: CheckoutOverviewPage;
    readonly complete: CheckoutCompletePage;
  };
}

export interface SauceDemoWorkerFixtures {
  readonly sauceDemoConfig: SauceDemoConfig;
}

export interface SauceDemoTestFixtures {
  /** Page objects on an anonymous page, for scenarios about the login form itself. */
  readonly sauceDemo: SauceDemoUi;
  /**
   * Precondition: the standard user's session is injected into the fresh context (Sauce Demo keeps
   * its session in the `session-username` cookie) and the inventory is open. No form login.
   */
  readonly signedInSauceDemo: SauceDemoUi;
}

export const test = core.extend<SauceDemoTestFixtures, SauceDemoWorkerFixtures>({
  sauceDemoConfig: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring here.
    async ({}, use) => {
      await use(loadSauceDemoConfig());
    },
    { scope: 'worker' },
  ],

  sauceDemo: async ({ page, sauceDemoConfig }, use) => {
    const { baseUrl } = sauceDemoConfig;
    await use({
      login: new LoginPage(page, baseUrl),
      inventory: new InventoryPage(page, baseUrl),
      checkout: {
        cart: new CartPage(page, baseUrl),
        information: new CheckoutInformationPage(page, baseUrl),
        overview: new CheckoutOverviewPage(page, baseUrl),
        complete: new CheckoutCompletePage(page, baseUrl),
      },
    });
  },

  signedInSauceDemo: async ({ page, sauceDemo, sauceDemoConfig }, use) => {
    await core.step(
      `inject Sauce Demo session for ${sauceDemoConfig.standardUsername}`,
      async () => {
        await page.context().addCookies([
          {
            name: 'session-username',
            value: sauceDemoConfig.standardUsername,
            url: sauceDemoConfig.baseUrl,
          },
        ]);
        await sauceDemo.inventory.open();
      },
    );
    await use(sauceDemo);
  },
});
