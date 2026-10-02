import { mergeTests } from '@playwright/test';
import { test as localTest } from './fixtures/local.ts';
import { test as restfulBookerTest } from './fixtures/restful-booker.ts';

/**
 * The project-level `test`. Each target contributes its own fixture module; adding a target means
 * adding one module to this merge, never editing a registry or factory map.
 */
export const test = mergeTests(restfulBookerTest, localTest);
export { expect } from '@playwright/test';
