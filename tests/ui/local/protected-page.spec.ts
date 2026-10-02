import { localBookingRequest } from '../../../framework/api/local/bookings/booking-data.ts';
import { Secret } from '../../../framework/diagnostics/secret.ts';
import { expect, test } from '../../../framework/test.ts';
import { LOCAL_SESSION_COOKIE } from '../../../framework/ui/local/local-ui-texts.ts';

const TAGS = ['@ui', '@local-stand'];

test.describe('local protected bookings page', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Protected UI',
      owner: 'web-qa',
      severity: 'critical',
    },
  });

  test.describe('opened with an API-issued session', () => {
    test(
      'NEW user sees exactly their bookings without a form login',
      { tag: ['@smoke', ...TAGS] },
      async ({ signedInLocalUi: { bookings }, localBookingSteps, testUser, testData }) => {
        const created = [
          await localBookingSteps.create(testUser.session, localBookingRequest(testData)),
          await localBookingSteps.create(testUser.session, localBookingRequest(testData)),
        ];

        await bookings.open();

        await bookings.expectSignedInAs(testUser.profile.displayName);
        await bookings.expectBookings(created);
      },
    );

    test.describe('EXISTING user', () => {
      test.use({ userMode: 'EXISTING' });

      test(
        'sees the booking just created through the API',
        { tag: ['@regression', ...TAGS] },
        async ({ signedInLocalUi: { bookings }, localBookingSteps, testUser, testData }) => {
          const created = await localBookingSteps.create(
            testUser.session,
            localBookingRequest(testData),
          );

          await bookings.open();

          await bookings.expectSignedInAs(testUser.profile.displayName);
          await expect(bookings.row(created.guestName)).toHaveCount(1);
        },
      );
    });

    test(
      'signing out ends the API-issued session',
      { tag: ['@regression', ...TAGS] },
      async ({ signedInLocalUi, authenticatedPage, localApi, testUser }) => {
        await signedInLocalUi.bookings.open();
        await signedInLocalUi.bookings.signOut();

        await signedInLocalUi.login.expectShownFor('signed_out');
        await expect(localApi.auth.check(testUser.session)).resolves.toMatchObject({
          kind: 'rejected',
        });
        expect(await authenticatedPage.context().cookies()).toEqual([]);
      },
    );
  });

  test.describe('rejected sessions', () => {
    test(
      'missing session redirects to sign-in',
      { tag: ['@regression', ...TAGS] },
      async ({ localUi }) => {
        await localUi.bookings.open();

        await localUi.login.expectShownFor('session_missing');
      },
    );

    test(
      'unknown session token redirects to sign-in',
      { tag: ['@regression', ...TAGS] },
      async ({ page, localUi, localAppConfig, testData }) => {
        await page
          .context()
          .addCookies([
            { name: LOCAL_SESSION_COOKIE, value: testData.token(32), url: localAppConfig.baseUrl },
          ]);

        await localUi.bookings.open();

        await localUi.login.expectShownFor('session_invalid');
      },
    );

    test(
      'expired session redirects to sign-in',
      { tag: ['@regression', ...TAGS] },
      async ({ page, localUi, localApi, localAppConfig, newUser }) => {
        const shortLived = await localApi.auth.login(newUser.credentials, 1);
        await page.context().addCookies([
          {
            name: LOCAL_SESSION_COOKIE,
            value: shortLived.token.reveal(),
            url: localAppConfig.baseUrl,
          },
        ]);
        await expect
          .poll(async () => (await localApi.auth.check(shortLived)).kind, {
            message: 'short-lived session to expire',
            timeout: 5_000,
            intervals: [250],
          })
          .toBe('rejected');

        await localUi.bookings.open();

        await localUi.login.expectShownFor('session_expired');
      },
    );
  });

  test.describe('form login (subject: authentication UI)', () => {
    test(
      'valid credentials open the protected page',
      { tag: ['@smoke', ...TAGS] },
      async ({ localUi, newUser }) => {
        await localUi.login.open();
        await localUi.login.signIn(newUser.credentials);

        await localUi.bookings.expectSignedInAs(newUser.profile.displayName);
        await localUi.bookings.expectBookings([]);
      },
    );

    test(
      'wrong password shows an error',
      { tag: ['@regression', ...TAGS] },
      async ({ localUi, newUser, testData }) => {
        await localUi.login.open();
        await localUi.login.signIn({
          email: newUser.credentials.email,
          password: Secret.of(testData.unique('wrong')),
        });

        await localUi.login.expectShownFor('invalid_credentials');
      },
    );
  });
});
