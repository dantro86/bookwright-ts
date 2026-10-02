import { AllureReporter } from 'allure-playwright';
import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { REDACTED, redactText } from '../diagnostics/redaction.ts';
import { SECRET_INPUT_MARKER } from '../ui/secret-input.ts';

/** Playwright titles input actions with the typed text: `Fill "value"`. */
const INPUT_STEP = /^(Fill|Type|Press sequentially|Insert text) "(.*)"(.*)$/s;

/**
 * Masks the typed value of input steps nested in a `fillSecret` step, then scrubs credential
 * shapes from every title. The reporter process cannot know secrets generated inside workers, so
 * the decision comes from the marker the framework puts on secret input.
 */
export function redactStepTitle(title: string, insideSecretInput: boolean): string {
  const match = INPUT_STEP.exec(title);
  if (match && insideSecretInput) {
    return `${match[1] ?? ''} "${REDACTED}"${match[3] ?? ''}`;
  }
  return redactText(title);
}

/** Allure Playwright reporter that never records secret input values in step titles. */
export default class SafeAllureReporter extends AllureReporter {
  override onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    maskTitle(step);
    super.onStepBegin(test, result, step);
  }

  override onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    maskTitle(step);
    super.onStepEnd(test, result, step);
  }
}

function maskTitle(step: TestStep): void {
  const masked = redactStepTitle(step.title, hasSecretInputAncestor(step));
  if (masked !== step.title) {
    Object.defineProperty(step, 'title', { value: masked, writable: true, configurable: true });
  }
}

function hasSecretInputAncestor(step: TestStep): boolean {
  for (let parent = step.parent; parent; parent = parent.parent) {
    if (parent.title.endsWith(SECRET_INPUT_MARKER)) return true;
  }
  return false;
}
