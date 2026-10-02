import { localBookingRequest } from '../../framework/api/local/bookings/booking-data.ts';
import { expect } from '../../framework/test.ts';
import { LOCAL_SESSION_COOKIE } from '../../framework/ui/local/local-ui-texts.ts';
import { test } from './support/in-process-local-app.ts';

test.describe('browser context isolation under concurrency', () => {
  test.describe.configure({ mode: 'parallel' });

  for (let index = 0; index < 4; index++) {
    test(`authenticated context ${index} carries only its own session`, async ({
      signedInLocalUi: { bookings },
      authenticatedPage,
      localBookingSteps,
      testUser,
      testData,
    }) => {
      const own = await localBookingSteps.create(testUser.session, localBookingRequest(testData));

      await bookings.open();

      await bookings.expectSignedInAs(testUser.profile.displayName);
      await bookings.expectBookings([own]);
      const cookies = await authenticatedPage.context().cookies();
      expect(cookies.map(({ name, value }) => ({ name, value }))).toEqual([
        { name: LOCAL_SESSION_COOKIE, value: testUser.session.token.reveal() },
      ]);
    });
  }

  test('the default page stays anonymous next to an authenticated context', async ({
    page,
    authenticatedPage,
    localUi,
  }) => {
    expect(page.context()).not.toBe(authenticatedPage.context());
    expect(await page.context().cookies()).toEqual([]);

    await localUi.bookings.open();

    await localUi.login.expectShownFor('session_missing');
  });
});
