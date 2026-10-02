import { expect, test, type Locator, type Page } from '@playwright/test';
import { SAUCE_DEMO_TEXTS, formatPrice, type Product, type SortOrder } from '../catalog.ts';

export class InventoryPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly title: Locator;
  readonly items: Locator;
  readonly sort: Locator;
  readonly cartLink: Locator;
  readonly cartBadge: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
    this.sort = page.getByTestId('product-sort-container');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
  }

  async open(): Promise<void> {
    await this.#page.goto(`${this.#baseUrl}/inventory.html`);
    await this.expectOpened();
  }

  async expectOpened(): Promise<void> {
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/inventory.html`);
    await expect(this.title).toHaveText(SAUCE_DEMO_TEXTS.inventoryTitle);
  }

  /** The product card whose visible name matches exactly; child controls are scoped to it. */
  item(name: string): Locator {
    return this.items.filter({
      has: this.#page.getByTestId('inventory-item-name').getByText(name, { exact: true }),
    });
  }

  /** The card's cart toggle; image and title links on the card also carry `role="button"`. */
  cartButton(name: string): Locator {
    return this.item(name).getByRole('button', { name: /^(Add to cart|Remove)$/ });
  }

  async sortBy(order: SortOrder): Promise<void> {
    await this.sort.selectOption(order);
  }

  /** Asserts the complete rendered catalog, in order: names and prices of every card. */
  async expectProducts(products: readonly Product[]): Promise<void> {
    await expect(this.items.getByTestId('inventory-item-name')).toHaveText(
      products.map((p) => p.name),
    );
    await expect(this.items.getByTestId('inventory-item-price')).toHaveText(
      products.map((p) => formatPrice(p.price)),
    );
  }

  async addToCart(name: string): Promise<void> {
    await test.step(`add "${name}" to the cart`, async () => {
      const card = this.item(name);
      await card.getByRole('button', { name: 'Add to cart' }).click();
      await expect(card.getByRole('button', { name: 'Remove' })).toBeVisible();
    });
  }

  async expectCartCount(count: number): Promise<void> {
    if (count === 0) {
      await expect(this.cartBadge).toBeHidden();
    } else {
      await expect(this.cartBadge).toHaveText(String(count));
    }
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
