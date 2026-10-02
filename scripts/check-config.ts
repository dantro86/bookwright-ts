// Validates every configuration section available on the selected stand and prints one aggregated
// report. Values are never printed. Exit code 1 means at least one section is invalid.
import type { z } from 'zod';
import { localAppSection } from '../framework/api/local/config.ts';
import { restfulBookerSection } from '../framework/api/restful-booker/config.ts';
import { coreSection, ensureRunSeed } from '../framework/config/core.ts';
import {
  ConfigValidationError,
  isAvailable,
  loadSection,
  resolveStand,
  type ConfigSection,
} from '../framework/config/section.ts';
import { databaseSection } from '../framework/db/config.ts';
import { sauceDemoSection } from '../framework/ui/saucedemo/config.ts';

interface Check {
  readonly name: string;
  readonly available: boolean;
  readonly load: () => unknown;
}

ensureRunSeed();
const stand = resolveStand(process.env);

function check<Shape extends z.ZodRawShape>(section: ConfigSection<Shape>): Check {
  return {
    name: section.name,
    available: isAvailable(section, stand),
    load: () => loadSection(section),
  };
}

const checks = [
  check(coreSection),
  check(restfulBookerSection),
  check(localAppSection),
  check(sauceDemoSection),
  check(databaseSection),
];
const failures: string[] = [];
const skipped = checks.filter((entry) => !entry.available).map((entry) => entry.name);

for (const entry of checks.filter((candidate) => candidate.available)) {
  try {
    entry.load();
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
const checked = checks.length - skipped.length;
const skippedNote = skipped.length > 0 ? `; not on this stand: ${skipped.join(', ')}` : '';
console.log(`configuration valid for stand "${stand}" (${checked} sections${skippedNote})`);
