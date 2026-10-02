import { expect, type Locator, type Page } from '@playwright/test';
import { LOCAL_ROOMS } from '../../../api/local/bookings/booking-data.ts';
import type { LocalBooking } from '../../../api/local/bookings/booking-schemas.ts';
import { LOCAL_UI_TEXTS } from '../local-ui-texts.ts';

export class LocalBookingsPage {
  readonly #page: Page;
  readonly #baseUrl: string;
  readonly heading: Locator;
  readonly signedInUser: Locator;
  readonly rows: Locator;

  constructor(page: Page, baseUrl: string) {
    this.#page = page;
    this.#baseUrl = baseUrl;
    this.heading = page.getByRole('heading', { level: 1 });
    this.signedInUser = page.getByTestId('signed-in-user');
    this.rows = page.getByRole('list', { name: 'Bookings' }).getByTestId('booking');
  }

  /** Navigates to the protected page; the outcome depends on the session in this context. */
  async open(): Promise<void> {
    await this.#page.goto(`${this.#baseUrl}/bookings`);
  }

  async expectSignedInAs(displayName: string): Promise<void> {
    await expect(this.#page).toHaveURL(`${this.#baseUrl}/bookings`);
    await expect(this.heading).toHaveText(LOCAL_UI_TEXTS.bookingsHeading);
    await expect(this.signedInUser).toHaveText(`Signed in as ${displayName}`);
  }

  /** The row for one booking, scoped by its visible guest name. */
  row(guestName: string): Locator {
    return this.rows.filter({
      has: this.#page.getByTestId('booking-guest').getByText(guestName, { exact: true }),
    });
  }

  /** Complete list state: every row, in order, with guest, room and dates. */
  async expectBookings(bookings: readonly LocalBooking[]): Promise<void> {
    if (bookings.length === 0) {
      await expect(this.#page.getByTestId('empty-bookings')).toHaveText(
        LOCAL_UI_TEXTS.emptyBookings,
      );
      await expect(this.rows).toHaveCount(0);
      return;
    }
    await expect(this.rows.getByTestId('booking-guest')).toHaveText(
      bookings.map((b) => b.guestName),
    );
    await expect(this.rows.getByTestId('booking-room')).toHaveText(
      bookings.map((b) => LOCAL_ROOMS[b.roomId] ?? `Room ${b.roomId}`),
    );
    await expect(this.rows.getByTestId('booking-dates')).toHaveText(
      bookings.map((b) => `${b.checkin} → ${b.checkout}`),
    );
  }

  async signOut(): Promise<void> {
    await this.#page.getByRole('button', { name: 'Sign out' }).click();
  }
}
