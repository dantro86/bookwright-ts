import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Secret } from '../../../diagnostics/secret.ts';
import { fillSecret } from '../../secret-input.ts';

export class LoginPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.username = page.getByPlaceholder('Username');
    this.password = page.getByPlaceholder('Password');
    this.submit = page.getByRole('button', { name: 'Login' });
    this.error = page.getByTestId('error');
  }

  async open(): Promise<void> {
    await this.#page.goto(`${this.#baseUrl}/`);
    await expect(this.submit).toBeVisible();
  }

  async signIn(username: string, password: Secret): Promise<void> {
    await test.step(`sign in to Sauce Demo as ${username}`, async () => {
      await this.username.fill(username);
      await fillSecret(this.password, password, 'password');
      await this.submit.click();
    });
  }

  async expectRejected(message: string): Promise<void> {
    await expect(this.error).toHaveText(message);
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/`);
    await expect(this.username).toHaveClass(/error/);
  }
}
