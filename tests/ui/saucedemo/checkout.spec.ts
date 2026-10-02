import { test } from '../../../framework/test.ts';
import { SAUCE_DEMO_CATALOG } from '../../../framework/ui/saucedemo/catalog.ts';
import { customerDetails } from '../../../framework/ui/saucedemo/checkout/customer-data.ts';

test.describe('Sauce Demo checkout', () => {
  test.use({
    reportLabels: { epic: 'Sauce Demo', feature: 'Checkout', owner: 'web-qa', severity: 'blocker' },
  });

  test(
    'cart to checkout to completion',
    { tag: ['@smoke', '@ui'] },
    async ({ signedInSauceDemo, testData }) => {
      const { inventory, checkout } = signedInSauceDemo;
      const products = testData.sample(SAUCE_DEMO_CATALOG, 2);

      for (const product of products) {
        await inventory.addToCart(product.name);
      }
      await inventory.expectCartCount(products.length);

      await inventory.openCart();
      await checkout.cart.expectContents(products);
      await checkout.cart.checkout();

      await checkout.information.submit(customerDetails(testData));
      await checkout.overview.expectSummary(products);
      await checkout.overview.finish();

      await checkout.complete.expectCompleted();
    },
  );
});
