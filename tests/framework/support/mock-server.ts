import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** One scripted reaction of the mock server. */
export type MockReply =
  | { readonly kind: 'json'; readonly status: number; readonly body: unknown }
  | {
      readonly kind: 'raw';
      readonly status: number;
      readonly contentType: string;
      readonly body: string;
    }
  /** Closes the socket without a response. */
  | { readonly kind: 'disconnect' }
  /** Never answers; the client must time out. */
  | { readonly kind: 'hang' };

export const json = (status: number, body: unknown): MockReply => ({ kind: 'json', status, body });
export const raw = (status: number, contentType: string, body: string): MockReply => ({
  kind: 'raw',
  status,
  contentType,
  body,
});

/**
 * Local HTTP server for framework self-tests. Each route plays a scripted sequence of replies; the
 * last reply repeats. Every received request is recorded so tests can prove "no implicit retries".
 */
export class MockServer {
  readonly #routes = new Map<string, readonly MockReply[]>();
  readonly #hits = new Map<string, number>();
  readonly #server = createServer((request, response) => {
    this.#handle(request, response);
  });

  static async start(): Promise<MockServer> {
    const mock = new MockServer();
    await new Promise<void>((resolve) => mock.#server.listen(0, '127.0.0.1', resolve));
    return mock;
  }

  get url(): string {
    const { port } = this.#server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  /** `route` is `METHOD /path`, e.g. `GET /items`. */
  script(route: string, ...replies: readonly MockReply[]): void {
    this.#routes.set(route, replies);
    this.#hits.set(route, 0);
  }

  hits(route: string): number {
    return this.#hits.get(route) ?? 0;
  }

  async stop(): Promise<void> {
    this.#server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  #handle(request: IncomingMessage, response: ServerResponse): void {
    const route = `${request.method ?? 'GET'} ${new URL(request.url ?? '/', this.url).pathname}`;
    const replies = this.#routes.get(route);
    if (!replies || replies.length === 0) {
      response.writeHead(599).end(`unscripted route ${route}`);
      return;
    }
    const hit = this.#hits.get(route) ?? 0;
    this.#hits.set(route, hit + 1);
    const reply = replies[Math.min(hit, replies.length - 1)];
    switch (reply?.kind) {
      case 'json':
        response
          .writeHead(reply.status, { 'content-type': 'application/json' })
          .end(JSON.stringify(reply.body));
        return;
      case 'raw':
        response.writeHead(reply.status, { 'content-type': reply.contentType }).end(reply.body);
        return;
      case 'disconnect':
        request.socket.destroy();
        return;
      case 'hang':
      case undefined:
        return;
    }
  }
}
