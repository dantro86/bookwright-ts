import { Secret } from '../../../framework/diagnostics/secret.ts';
import { test } from '../../../framework/test.ts';
import { SAUCE_DEMO_TEXTS, expectedOrder } from '../../../framework/ui/saucedemo/catalog.ts';

test.describe('Sauce Demo login', () => {
  test.use({
    reportLabels: { epic: 'Sauce Demo', feature: 'Login', owner: 'web-qa', severity: 'blocker' },
  });

  test(
    'standard user signs in and sees the complete catalog',
    { tag: ['@smoke', '@ui'] },
    async ({ sauceDemo, sauceDemoConfig }) => {
      await sauceDemo.login.open();
      await sauceDemo.login.signIn(sauceDemoConfig.standardUsername, sauceDemoConfig.password);

      await sauceDemo.inventory.expectOpened();
      await sauceDemo.inventory.expectProducts(expectedOrder('az'));
      await sauceDemo.inventory.expectCartCount(0);
    },
  );

  test(
    'wrong password is rejected',
    { tag: ['@regression', '@ui'] },
    async ({ sauceDemo, sauceDemoConfig, testData }) => {
      await sauceDemo.login.open();
      await sauceDemo.login.signIn(
        sauceDemoConfig.standardUsername,
        Secret.of(testData.unique('wrong')),
      );

      await sauceDemo.login.expectRejected(SAUCE_DEMO_TEXTS.invalidCredentials);
    },
  );

  test(
    'locked-out user is rejected',
    { tag: ['@regression', '@ui'] },
    async ({ sauceDemo, sauceDemoConfig }) => {
      await sauceDemo.login.open();
      await sauceDemo.login.signIn(sauceDemoConfig.lockedOutUsername, sauceDemoConfig.password);

      await sauceDemo.login.expectRejected(SAUCE_DEMO_TEXTS.lockedOut);
    },
  );
});
