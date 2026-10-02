import { expect, test } from '../../../framework/test.ts';
import {
  SAUCE_DEMO_CATALOG,
  SORT_ORDERS,
  expectedOrder,
} from '../../../framework/ui/saucedemo/catalog.ts';

test.describe('Sauce Demo inventory', () => {
  test.use({
    reportLabels: {
      epic: 'Sauce Demo',
      feature: 'Inventory',
      owner: 'web-qa',
      severity: 'critical',
    },
  });

  for (const [description, order] of Object.entries(SORT_ORDERS)) {
    test(
      `sorting by ${description} renders the complete catalog in order`,
      { tag: ['@regression', '@ui'] },
      async ({ signedInSauceDemo: { inventory } }) => {
        await inventory.sortBy(order);

        await inventory.expectProducts(expectedOrder(order));
      },
    );
  }

  test(
    'products are selected through their own card',
    { tag: ['@smoke', '@ui'] },
    async ({ signedInSauceDemo: { inventory }, testData }) => {
      const selected = testData.sample(SAUCE_DEMO_CATALOG, 3);

      for (const product of selected) {
        await inventory.addToCart(product.name);
      }

      await inventory.expectCartCount(selected.length);
      for (const product of SAUCE_DEMO_CATALOG) {
        const button = selected.includes(product) ? 'Remove' : 'Add to cart';
        await expect(inventory.cartButton(product.name)).toHaveText(button);
      }
    },
  );
});
