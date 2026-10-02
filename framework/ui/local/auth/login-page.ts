import { expect, test, type Locator, type Page } from '@playwright/test';
import type { LocalCredentials } from '../../../api/local/auth/local-session.ts';
import { LOCAL_UI_TEXTS, type LoginNotice } from '../local-ui-texts.ts';
import { fillSecret } from '../../secret-input.ts';

/** Form login is kept only for scenarios whose subject is authentication itself. */
export class LocalLoginPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly heading: Locator;
  readonly notice: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.heading = page.getByRole('heading', { level: 1 });
    this.notice = page.getByRole('status');
  }

  async open(): Promise<void> {
    await this.#page.goto(`${this.#baseUrl}/login`);
    await expect(this.heading).toHaveText(LOCAL_UI_TEXTS.loginHeading);
  }

  async signIn(credentials: LocalCredentials): Promise<void> {
    await test.step(`sign in through the form as ${credentials.email}`, async () => {
      await this.#page.getByLabel('Email').fill(credentials.email);
      await fillSecret(this.#page.getByLabel('Password'), credentials.password, 'password');
      await this.#page.getByRole('button', { name: 'Sign in' }).click();
    });
  }

  /** The login page is shown with the notice for `reason`. */
  async expectShownFor(reason: LoginNotice): Promise<void> {
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/login?reason=${reason}`);
    await expect(this.heading).toHaveText(LOCAL_UI_TEXTS.loginHeading);
    await expect(this.notice).toHaveText(LOCAL_UI_TEXTS.notices[reason]);
  }
}
