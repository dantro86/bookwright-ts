import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SESSION_COOKIE, bookingsPage, loginPage } from './pages.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import type { MemoryStore, SessionRecord, UserRecord } from './store.ts';

export interface SeedUser {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export interface AppOptions {
  readonly store: MemoryStore;
  readonly defaultSessionTtlSeconds: number;
  readonly seedUsers?: readonly SeedUser[];
  readonly logger?: boolean;
}

const Registration = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80),
});

const Login = z.object({
  email: z.string(),
  password: z.string(),
  ttlSeconds: z.number().int().min(1).max(86_400).optional(),
});

const NewBooking = z
  .object({
    roomId: z.number().int().positive(),
    guestName: z.string().trim().min(1).max(120),
    checkin: z.iso.date(),
    checkout: z.iso.date(),
  })
  .refine((booking) => booking.checkin < booking.checkout, {
    message: 'checkout must be after checkin',
    path: ['checkout'],
  });

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const UserIdParam = z.object({ id: z.uuid() });

type SessionError = 'session_missing' | 'session_invalid' | 'session_expired';
type Authenticated = { readonly user: UserRecord; readonly session: SessionRecord };

function profile(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function sendError(reply: FastifyReply, status: number, error: string, message: string) {
  return reply.code(status).send({ error, message });
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/**
 * Small booking application used as the integrated system under test. The JSON API authenticates
 * with `Authorization: Bearer <token>` and never sets cookies; the HTML pages read the same token
 * from the `bw_session` cookie, set either by the login form or injected by tests.
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { store } = options;
  const app = Fastify({ logger: options.logger ?? false });

  for (const seed of options.seedUsers ?? []) {
    if (store.findUserByEmail(seed.email) === undefined) {
      store.createUser({
        email: seed.email,
        displayName: seed.displayName,
        passwordHash: await hashPassword(seed.password),
      });
    }
  }

  function authenticate(request: FastifyRequest): Authenticated | SessionError {
    const header = request.headers.authorization;
    const token =
      header === undefined
        ? cookieValue(request.headers.cookie, SESSION_COOKIE)
        : /^Bearer (\S+)$/.exec(header)?.[1];
    if (header === undefined && token === undefined) return 'session_missing';
    const session = token === undefined ? undefined : store.findSession(token);
    if (session === undefined) return 'session_invalid';
    // Expired sessions stay recorded so every later request keeps reporting "expired".
    if (session.expiresAt <= Date.now()) return 'session_expired';
    const user = store.findUser(session.userId);
    return user === undefined ? 'session_invalid' : { user, session };
  }

  async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<Authenticated | undefined> {
    const result = authenticate(request);
    if (typeof result === 'string') {
      await sendError(reply, 401, result, 'authentication required');
      return undefined;
    }
    return result;
  }

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return sendError(reply, 400, 'validation_failed', z.prettifyError(error));
    }
    app.log.error(error);
    return sendError(reply, 500, 'internal_error', 'unexpected server error');
  });

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    },
  );

  app.get('/health', () => ({ status: 'ok' }));

  app.get('/login', (request, reply) => {
    const { reason } = request.query as { reason?: string };
    return reply.type('text/html').send(loginPage(reason));
  });

  app.post('/login', async (request, reply) => {
    const form = z.object({ email: z.string(), password: z.string() }).parse(request.body);
    const user = store.findUserByEmail(form.email);
    if (user === undefined || !(await verifyPassword(form.password, user.passwordHash))) {
      return reply.redirect('/login?reason=invalid_credentials', 303);
    }
    const ttlSeconds = options.defaultSessionTtlSeconds;
    const session = store.createSession(user.id, Date.now() + ttlSeconds * 1_000);
    return reply
      .header('set-cookie', sessionCookie(session.token, ttlSeconds))
      .redirect('/bookings', 303);
  });

  app.post('/logout', (request, reply) => {
    const auth = authenticate(request);
    if (typeof auth !== 'string') store.deleteSession(auth.session.token);
    return reply
      .header('set-cookie', sessionCookie('', 0))
      .redirect('/login?reason=signed_out', 303);
  });

  app.get('/bookings', (request, reply) => {
    const auth = authenticate(request);
    if (typeof auth === 'string') {
      return reply.redirect(`/login?reason=${auth}`, 303);
    }
    const html = bookingsPage(
      auth.user,
      store.listBookings(auth.user.id),
      (roomId) => store.findRoom(roomId)?.name,
    );
    return reply.type('text/html').send(html);
  });

  app.post('/api/users', async (request, reply) => {
    const body = Registration.parse(request.body);
    if (store.findUserByEmail(body.email) !== undefined) {
      return sendError(reply, 409, 'email_taken', 'email is already registered');
    }
    const user = store.createUser({
      email: body.email,
      displayName: body.displayName,
      passwordHash: await hashPassword(body.password),
    });
    return reply.code(201).send(profile(user));
  });

  app.get('/api/users/me', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    return auth && profile(auth.user);
  });

  app.delete('/api/users/:id', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return reply;
    const { id } = UserIdParam.parse(request.params);
    if (id !== auth.user.id) {
      return sendError(reply, 403, 'forbidden', 'users can delete only themselves');
    }
    store.deleteUser(id);
    return reply.code(204).send();
  });

  app.post('/api/sessions', async (request, reply) => {
    const body = Login.parse(request.body);
    const user = store.findUserByEmail(body.email);
    if (user === undefined || !(await verifyPassword(body.password, user.passwordHash))) {
      return sendError(reply, 401, 'invalid_credentials', 'email or password is incorrect');
    }
    const ttlSeconds = body.ttlSeconds ?? options.defaultSessionTtlSeconds;
    const session = store.createSession(user.id, Date.now() + ttlSeconds * 1_000);
    return reply.code(201).send({
      token: session.token,
      userId: user.id,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  });

  app.get('/api/sessions/current', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    return (
      auth && { userId: auth.user.id, expiresAt: new Date(auth.session.expiresAt).toISOString() }
    );
  });

  app.delete('/api/sessions/current', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return reply;
    store.deleteSession(auth.session.token);
    return reply.code(204).send();
  });

  app.post('/api/bookings', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return reply;
    const body = NewBooking.parse(request.body);
    if (store.findRoom(body.roomId) === undefined) {
      return sendError(reply, 422, 'unknown_room', `room ${body.roomId} does not exist`);
    }
    return reply.code(201).send(store.createBooking({ ...body, userId: auth.user.id }));
  });

  app.get('/api/bookings', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    return auth && store.listBookings(auth.user.id);
  });

  // Another user's booking answers 404, not 403, so ids of foreign bookings are not disclosed.
  app.get('/api/bookings/:id', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return reply;
    const booking = store.findBooking(IdParam.parse(request.params).id);
    if (booking?.userId !== auth.user.id) {
      return sendError(reply, 404, 'not_found', 'booking not found');
    }
    return booking;
  });

  app.delete('/api/bookings/:id', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return reply;
    const booking = store.findBooking(IdParam.parse(request.params).id);
    if (booking?.userId !== auth.user.id) {
      return sendError(reply, 404, 'not_found', 'booking not found');
    }
    store.deleteBooking(booking.id);
    return reply.code(204).send();
  });

  return app;
}
