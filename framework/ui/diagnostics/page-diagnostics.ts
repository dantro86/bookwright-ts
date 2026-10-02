import type { Page, TestInfo } from '@playwright/test';
import { redactText, redactUrl, truncate } from '../../diagnostics/redaction.ts';
import { sanitizeTrace } from '../../diagnostics/trace-sanitizer.ts';

const MAX_EVENTS = 50;
const MAX_HTML_LENGTH = 1_000_000;

export interface Artifact {
  readonly body: string | Buffer;
  readonly contentType: string;
}

/** One independent capture. A failing capturer never prevents the others from running. */
export interface Capturer {
  readonly name: string;
  readonly capture: () => Promise<
    Artifact | { readonly path: string; readonly contentType: string }
  >;
}

export type Attach = TestInfo['attach'];

/**
 * Runs every capturer in isolation and attaches what it produced. Capture failures are collected
 * into one `artifact capture failures` attachment instead of interrupting the remaining captures.
 */
export async function captureIndependently(
  capturers: readonly Capturer[],
  attach: Attach,
  label: string,
): Promise<readonly string[]> {
  const failures: string[] = [];
  for (const capturer of capturers) {
    try {
      await attach(`${label} ${capturer.name}`, await capturer.capture());
    } catch (error) {
      failures.push(
        `${capturer.name}: ${redactText(error instanceof Error ? error.message : String(error))}`,
      );
    }
  }
  if (failures.length > 0) {
    await attach(`${label} artifact capture failures`, {
      body: failures.join('\n'),
      contentType: 'text/plain',
    });
  }
  return failures;
}

/**
 * Watches one page from creation to teardown: records console errors, page errors and failed
 * requests, and traces its context. On test failure every artifact is captured independently and
 * sanitized; on success the trace is discarded.
 */
export class PageDiagnostics {
  readonly #page: Page;
  readonly #label: string;
  readonly #consoleErrors: string[] = [];
  readonly #pageErrors: string[] = [];
  readonly #failedRequests: string[] = [];

  private constructor(page: Page, label: string) {
    this.#page = page;
    this.#label = label;
  }

  static async watch(page: Page, label: string): Promise<PageDiagnostics> {
    const diagnostics = new PageDiagnostics(page, label);
    page.on('console', (message) => {
      if (message.type() === 'error')
        diagnostics.#record(diagnostics.#consoleErrors, message.text());
    });
    page.on('pageerror', (error) => {
      diagnostics.#record(diagnostics.#pageErrors, `${error.name}: ${error.message}`);
    });
    page.on('requestfailed', (request) => {
      diagnostics.#record(
        diagnostics.#failedRequests,
        `${request.method()} ${redactUrl(request.url())}: ${request.failure()?.errorText ?? 'failed'}`,
      );
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        diagnostics.#record(
          diagnostics.#failedRequests,
          `${response.request().method()} ${redactUrl(response.url())}: HTTP ${response.status()}`,
        );
      }
    });
    await page.context().tracing.start({ screenshots: true, snapshots: true, sources: false });
    return diagnostics;
  }

  /** Call before the page's context closes. */
  async finish(testInfo: TestInfo): Promise<void> {
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (!failed) {
      await this.#page.context().tracing.stop();
      return;
    }
    const attach: Attach = (name, options) => testInfo.attach(name, options);
    await captureIndependently(this.#capturers(testInfo), attach, this.#label);
  }

  #capturers(testInfo: TestInfo): Capturer[] {
    const page = this.#page;
    const text = (lines: readonly string[]): Artifact => ({
      body: lines.length > 0 ? lines.join('\n') : '(none)',
      contentType: 'text/plain',
    });
    return [
      {
        name: 'screenshot',
        capture: async () => ({
          body: await page.screenshot({ fullPage: true, timeout: 5_000 }),
          contentType: 'image/png',
        }),
      },
      {
        name: 'html',
        capture: async () => ({
          body: truncate(redactText(await page.content()), MAX_HTML_LENGTH),
          contentType: 'text/html',
        }),
      },
      {
        name: 'location',
        capture: () =>
          Promise.resolve({
            body: JSON.stringify(
              {
                url: redactUrl(page.url()),
                viewport: page.viewportSize(),
                closed: page.isClosed(),
              },
              null,
              2,
            ),
            contentType: 'application/json',
          }),
      },
      { name: 'console errors', capture: () => Promise.resolve(text(this.#consoleErrors)) },
      { name: 'page errors', capture: () => Promise.resolve(text(this.#pageErrors)) },
      { name: 'failed requests', capture: () => Promise.resolve(text(this.#failedRequests)) },
      {
        name: 'trace',
        capture: async () => {
          const path = testInfo.outputPath(`${this.#label.replace(/\W+/g, '-')}-trace.zip`);
          await page.context().tracing.stop({ path });
          await sanitizeTrace(path);
          return { path, contentType: 'application/zip' };
        },
      },
    ];
  }

  #record(events: string[], entry: string): void {
    if (events.length < MAX_EVENTS) {
      events.push(truncate(redactText(entry), 500));
    } else if (events.length === MAX_EVENTS) {
      events.push(`… further events dropped after ${MAX_EVENTS}`);
    }
  }
}
