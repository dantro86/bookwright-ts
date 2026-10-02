import { Secret } from '../../../diagnostics/secret.ts';
import type { TestData } from '../../../test-data/test-data.ts';
import type { Registration } from './user-schemas.ts';

/** Reserved `.test` domain: generated accounts can never reach a real mailbox. */
const EMAIL_DOMAIN = 'bookwright.test';

export function userRegistration(testData: TestData): Registration {
  return {
    email: `${testData.unique('user')}@${EMAIL_DOMAIN}`,
    password: Secret.of(`pw-${testData.token(20)}`),
    displayName: `${testData.firstName()} ${testData.lastName()}`,
  };
}
