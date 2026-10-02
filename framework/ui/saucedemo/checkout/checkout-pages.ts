import { expect, test, type Locator, type Page } from '@playwright/test';
import { SAUCE_DEMO_TEXTS, formatPrice, orderTotals, type Product } from '../catalog.ts';
import type { Customer } from './customer-data.ts';

/** Line items as rendered in the cart and the checkout overview. */
async function expectLineItems(page: Page, products: readonly Product[]): Promise<void> {
  const items = page.getByTestId('cart-list').getByTestId('inventory-item');
  await expect(items.getByTestId('inventory-item-name')).toHaveText(products.map((p) => p.name));
  await expect(items.getByTestId('inventory-item-price')).toHaveText(
    products.map((p) => formatPrice(p.price)),
  );
  await expect(items.getByTestId('item-quantity')).toHaveText(products.map(() => '1'));
}

export class CartPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly title: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.title = page.getByTestId('title');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
  }

  async expectContents(products: readonly Product[]): Promise<void> {
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/cart.html`);
    await expect(this.title).toHaveText(SAUCE_DEMO_TEXTS.cartTitle);
    await expectLineItems(this.#page, products);
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}

export class CheckoutInformationPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly title: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.title = page.getByTestId('title');
  }

  async submit(customer: Customer): Promise<void> {
    await test.step('enter customer information', async () => {
      await expect(this.#page).toHaveURL(`${this.#baseUrl}/checkout-step-one.html`);
      await expect(this.title).toHaveText(SAUCE_DEMO_TEXTS.informationTitle);
      await this.#page.getByPlaceholder('First Name').fill(customer.firstName);
      await this.#page.getByPlaceholder('Last Name').fill(customer.lastName);
      await this.#page.getByPlaceholder('Zip/Postal Code').fill(customer.postalCode);
      await this.#page.getByRole('button', { name: 'Continue' }).click();
    });
  }
}

export class CheckoutOverviewPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly title: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.title = page.getByTestId('title');
  }

  /** Full overview state: every line item, payment, shipping and all three totals. */
  async expectSummary(products: readonly Product[]): Promise<void> {
    const totals = orderTotals(products);
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/checkout-step-two.html`);
    await expect(this.title).toHaveText(SAUCE_DEMO_TEXTS.overviewTitle);
    await expectLineItems(this.#page, products);
    await expect(this.#page.getByTestId('payment-info-value')).toHaveText(
      SAUCE_DEMO_TEXTS.paymentInfo,
    );
    await expect(this.#page.getByTestId('shipping-info-value')).toHaveText(
      SAUCE_DEMO_TEXTS.shippingInfo,
    );
    await expect(this.#page.getByTestId('subtotal-label')).toHaveText(
      `Item total: ${formatPrice(totals.itemTotal)}`,
    );
    await expect(this.#page.getByTestId('tax-label')).toHaveText(`Tax: ${formatPrice(totals.tax)}`);
    await expect(this.#page.getByTestId('total-label')).toHaveText(
      `Total: ${formatPrice(totals.total)}`,
    );
  }

  async finish(): Promise<void> {
    await this.#page.getByRole('button', { name: 'Finish' }).click();
  }
}

export class CheckoutCompletePage {
  readonly #page: Page;
  readonly #baseUrl: string;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
  }

  async expectCompleted(): Promise<void> {
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/checkout-complete.html`);
    await expect(this.#page.getByTestId('title')).toHaveText(SAUCE_DEMO_TEXTS.completeTitle);
    await expect(this.#page.getByTestId('complete-header')).toHaveText(
      SAUCE_DEMO_TEXTS.completeHeader,
    );
    await expect(this.#page.getByTestId('shopping-cart-badge')).toBeHidden();
  }
}
