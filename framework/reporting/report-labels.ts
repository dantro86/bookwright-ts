import * as allure from 'allure-js-commons';

export type Severity = 'blocker' | 'critical' | 'normal' | 'minor' | 'trivial';

/**
 * Domain metadata for one `describe` block, set with `test.use({ reportLabels: { ... } })`.
 * Tags (`@smoke`, `@api`, ...) use Playwright's native `tag` option instead.
 */
export interface ReportLabels {
  readonly epic: string;
  readonly feature: string;
  readonly story?: string;
  readonly owner: string;
  readonly severity?: Severity;
}

export async function applyReportLabels(labels: ReportLabels): Promise<void> {
  await allure.epic(labels.epic);
  await allure.feature(labels.feature);
  await allure.owner(labels.owner);
  if (labels.story !== undefined) {
    await allure.story(labels.story);
  }
  if (labels.severity !== undefined) {
    await allure.severity(labels.severity);
  }
}

/** Excluded parameters are shown in Allure without splitting test history per seed. */
export async function recordReplayMetadata(details: {
  readonly runSeed: string;
  readonly testSeed: string;
  readonly replayCommand: string;
}): Promise<void> {
  await allure.parameter('run seed', details.runSeed, { excluded: true });
  await allure.parameter('test seed', details.testSeed, { excluded: true });
  await allure.attachment('replay command', details.replayCommand, 'text/plain');
}
