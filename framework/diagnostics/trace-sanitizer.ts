import { readFile, writeFile } from 'node:fs/promises';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { redactText, redactValue } from './redaction.ts';

const JSON_LINES = /\.(trace|network|stacks)$/;
/** Trace events nest deeper than diagnostics; keep their full structure for the trace viewer. */
const TRACE_EVENT_MAX_DEPTH = 64;

/**
 * Rewrites a Playwright trace archive in place so it can be attached safely. Event streams are
 * redacted structurally (sensitive keys, header/cookie pairs, known secrets); textual resources
 * (HTML snapshots, JSON and text bodies) are scrubbed as text; binary resources stay untouched.
 */
export async function sanitizeTrace(path: string): Promise<void> {
  const entries = unzipSync(new Uint8Array(await readFile(path)));
  const sanitized: Zippable = {};
  for (const [name, content] of Object.entries(entries)) {
    sanitized[name] = sanitizeEntry(name, content);
  }
  await writeFile(path, zipSync(sanitized, { level: 6 }));
}

function sanitizeEntry(name: string, content: Uint8Array): Uint8Array {
  if (!isText(content)) {
    return content;
  }
  const text = strFromU8(content);
  if (JSON_LINES.test(name)) {
    return strToU8(
      text
        .split('\n')
        .map((line) => (line.trim() === '' ? line : redactJsonLine(line)))
        .join('\n'),
    );
  }
  return strToU8(redactText(text));
}

function redactJsonLine(line: string): string {
  try {
    return JSON.stringify(redactValue(JSON.parse(line), TRACE_EVENT_MAX_DEPTH));
  } catch {
    return redactText(line);
  }
}

/** Heuristic: text has no NUL bytes in its first 8 KiB and decodes as UTF-8. */
function isText(content: Uint8Array): boolean {
  const head = content.subarray(0, 8_192);
  if (head.includes(0)) {
    return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head);
    return true;
  } catch {
    return false;
  }
}
