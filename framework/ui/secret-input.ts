import { test, type Locator } from '@playwright/test';
import type { Secret } from '../diagnostics/secret.ts';

/**
 * Playwright titles input steps with the typed text (`Fill "…"`). Secret input happens inside a
 * step carrying this marker; the reporter masks every input value below such a step.
 */
export const SECRET_INPUT_MARKER = '[secret input]';

export async function fillSecret(locator: Locator, secret: Secret, field: string): Promise<void> {
  await test.step(`enter ${field} ${SECRET_INPUT_MARKER}`, () => locator.fill(secret.reveal()));
}
