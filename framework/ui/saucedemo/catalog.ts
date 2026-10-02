/** Stable Sauce Demo expectations: the product catalog, pricing rules and fixed UI texts. */

export interface Product {
  readonly name: string;
  readonly price: number;
}

export const SAUCE_DEMO_CATALOG: readonly Product[] = Object.freeze([
  { name: 'Sauce Labs Backpack', price: 29.99 },
  { name: 'Sauce Labs Bike Light', price: 9.99 },
  { name: 'Sauce Labs Bolt T-Shirt', price: 15.99 },
  { name: 'Sauce Labs Fleece Jacket', price: 49.99 },
  { name: 'Sauce Labs Onesie', price: 7.99 },
  { name: 'Test.allTheThings() T-Shirt (Red)', price: 15.99 },
]);

export const TAX_RATE = 0.08;

export const SAUCE_DEMO_TEXTS = {
  inventoryTitle: 'Products',
  cartTitle: 'Your Cart',
  informationTitle: 'Checkout: Your Information',
  overviewTitle: 'Checkout: Overview',
  completeTitle: 'Checkout: Complete!',
  completeHeader: 'Thank you for your order!',
  invalidCredentials: 'Epic sadface: Username and password do not match any user in this service',
  lockedOut: 'Epic sadface: Sorry, this user has been locked out.',
  paymentInfo: 'SauceCard #31337',
  shippingInfo: 'Free Pony Express Delivery!',
} as const;

export const SORT_ORDERS = {
  'name ascending': 'az',
  'name descending': 'za',
  'price ascending': 'lohi',
  'price descending': 'hilo',
} as const;

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);

/** The complete catalog in the order Sauce Demo must render it; price ties keep name order. */
export function expectedOrder(order: SortOrder): readonly Product[] {
  const alphabetical = [...SAUCE_DEMO_CATALOG].sort(byName);
  switch (order) {
    case 'az':
      return alphabetical;
    case 'za':
      return alphabetical.reverse();
    case 'lohi':
      return alphabetical.sort((a, b) => a.price - b.price);
    case 'hilo':
      return alphabetical.sort((a, b) => b.price - a.price);
  }
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export interface OrderTotals {
  readonly itemTotal: number;
  readonly tax: number;
  readonly total: number;
}

export function orderTotals(products: readonly Product[]): OrderTotals {
  const itemTotal = round(products.reduce((sum, product) => sum + product.price, 0));
  const tax = round(itemTotal * TAX_RATE);
  return { itemTotal, tax, total: round(itemTotal + tax) };
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}
