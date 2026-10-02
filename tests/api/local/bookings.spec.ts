import { localBookingRequest } from '../../../framework/api/local/bookings/booking-data.ts';
import { BusinessOperationError } from '../../../framework/api/http/errors.ts';
import type { UserMode } from '../../../framework/api/local/users/user-schemas.ts';
import { expect, test } from '../../../framework/test.ts';

const USER_MODES: readonly UserMode[] = ['NEW', 'EXISTING'];

test.describe('local app bookings', () => {
  test.use({
    reportLabels: {
      epic: 'local booking app',
      feature: 'Bookings',
      owner: 'booking-qa',
      severity: 'critical',
    },
  });

  for (const userMode of USER_MODES) {
    test.describe(`as ${userMode} user`, () => {
      test.use({ userMode });

      test(
        'created booking is readable and listed for its owner',
        { tag: ['@smoke', '@api', '@local-stand'] },
        async ({ localApi, localBookingSteps, testUser, testData }) => {
          const request = localBookingRequest(testData);

          const created = await localBookingSteps.create(testUser.session, request);

          expect(created).toEqual({ ...request, id: created.id, userId: testUser.profile.id });
          await expect(
            localApi.bookings.requireById(testUser.session, created.id),
          ).resolves.toEqual(created);
          const own = await localApi.bookings.list(testUser.session);
          expect(own.filter((booking) => booking.id === created.id)).toEqual([created]);
        },
      );
    });
  }

  test(
    "another user's booking is not visible",
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, localBookingSteps, newUser, existingUser, testData }) => {
      const created = await localBookingSteps.create(
        newUser.session,
        localBookingRequest(testData),
      );

      await expect(
        localApi.bookings.findById(existingUser.session, created.id),
      ).resolves.toBeUndefined();
    },
  );

  test(
    'booking an unknown room is rejected',
    { tag: ['@regression', '@api', '@local-stand'] },
    async ({ localApi, newUser, testData }) => {
      const request = localBookingRequest(testData, { roomId: 999_999 });

      const failure = await localApi.bookings
        .create(newUser.session, request)
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(BusinessOperationError);
      expect((failure as Error).cause).toMatchObject({ expectedStatus: 201, actualStatus: 422 });
    },
  );
});
