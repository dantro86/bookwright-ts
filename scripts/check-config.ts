// Validates every configuration section for the selected stand and prints one aggregated report.
// Values are never printed. Exit code 1 means at least one section is invalid.
import { coreSection, ensureRunSeed } from '../framework/config/core.ts';
import { ConfigValidationError, loadSection, resolveStand } from '../framework/config/section.ts';
import { restfulBookerSection } from '../framework/api/restful-booker/config.ts';

ensureRunSeed();
const checks = [() => loadSection(coreSection), () => loadSection(restfulBookerSection)];
const failures: string[] = [];

for (const check of checks) {
  try {
    check();
  } catch (error) {
    if (!(error instanceof ConfigValidationError)) {
      throw error;
    }
    failures.push(error.message);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(
  `configuration valid for stand "${resolveStand(process.env)}" (${checks.length} sections)`,
);
