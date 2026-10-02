// Validates every configuration section available on the selected stand and prints one aggregated
// report. Values are never printed. Exit code 1 means at least one section is invalid.
import { localAppSection } from '../framework/api/local/config.ts';
import { restfulBookerSection } from '../framework/api/restful-booker/config.ts';
import { coreSection, ensureRunSeed } from '../framework/config/core.ts';
import {
  ConfigValidationError,
  isAvailable,
  loadSection,
  resolveStand,
} from '../framework/config/section.ts';
import { sauceDemoSection } from '../framework/ui/saucedemo/config.ts';

ensureRunSeed();
const stand = resolveStand(process.env);
const sections = [coreSection, restfulBookerSection, localAppSection, sauceDemoSection] as const;
const failures: string[] = [];
const skipped: string[] = [];
let checked = 0;

for (const section of sections) {
  if (!isAvailable(section, stand)) {
    skipped.push(section.name);
    continue;
  }
  checked += 1;
  try {
    // Each section has its own shape; the union call is safe because loadSection is generic.
    loadSection(section as Parameters<typeof loadSection>[0]);
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
const skippedNote = skipped.length > 0 ? `; not on this stand: ${skipped.join(', ')}` : '';
console.log(`configuration valid for stand "${stand}" (${checked} sections${skippedNote})`);
