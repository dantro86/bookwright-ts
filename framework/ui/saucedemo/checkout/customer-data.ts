import type { TestData } from '../../../test-data/test-data.ts';

export interface Customer {
  readonly firstName: string;
  readonly lastName: string;
  readonly postalCode: string;
}

export function customerDetails(testData: TestData): Customer {
  return {
    firstName: testData.firstName(),
    lastName: testData.lastName(),
    postalCode: String(testData.int(10_000, 99_999)),
  };
}
