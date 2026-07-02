import { Hono } from 'hono';
import { loadLatestSnapshot, saveLatestSnapshot } from './storage';
import type { AvailabilitySnapshot, Env } from './types';
import { Page } from './ui';

const app = new Hono<{ Bindings: Env }>();

app.get('/styles.css', (c) => c.env.ASSETS.fetch(c.req.raw));

app.get('/', async (c) => {
  const snapshot = await loadLatestSnapshot(c.env.AVAILABILITY_KV);
  return c.html(<Page snapshot={snapshot} />);
});

app.get('/api/availability', async (c) => {
  const snapshot = await loadLatestSnapshot(c.env.AVAILABILITY_KV);
  if (!snapshot) {
    return c.json({ ok: false, message: 'availability is not ready' }, 404);
  }
  return c.json(snapshot);
});

app.post('/admin/availability', async (c) => {
  const auth = authorize(c.req, c.env);
  if (!auth.ok) {
    return c.json({ ok: false, message: auth.message }, auth.status);
  }

  const body = await c.req.json().catch(() => null);
  if (!isAvailabilitySnapshot(body)) {
    return c.json({ ok: false, message: 'invalid availability snapshot' }, 400);
  }

  await saveLatestSnapshot(c.env.AVAILABILITY_KV, body);
  return c.json({
    ok: true,
    stored: true,
    checkedAt: body.checkedAt,
    parks: body.parks.length,
    facilities: body.facilities.length,
    slots: body.slots.length,
    errors: body.errors.length,
  });
});

const authorize = (
  req: {
    query: (name: string) => string | undefined;
    header: (name: string) => string | undefined;
  },
  env: Env,
) => {
  if (!env.ADMIN_TOKEN) {
    return {
      ok: false as const,
      status: 503 as const,
      message: 'admin token is not configured',
    };
  }
  const queryToken = req.query('token');
  const authHeader = req.header('authorization');
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (queryToken === env.ADMIN_TOKEN || bearerToken === env.ADMIN_TOKEN) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    status: 401 as const,
    message: 'invalid admin token',
  };
};

const isAvailabilitySnapshot = (
  value: unknown,
): value is AvailabilitySnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as Partial<AvailabilitySnapshot>;
  return (
    typeof snapshot.checkedAt === 'string' &&
    typeof snapshot.startedAt === 'string' &&
    typeof snapshot.finishedAt === 'string' &&
    typeof snapshot.ok === 'boolean' &&
    Array.isArray(snapshot.categories) &&
    Array.isArray(snapshot.parks) &&
    Array.isArray(snapshot.facilities) &&
    Array.isArray(snapshot.slots) &&
    Array.isArray(snapshot.errors)
  );
};

export default {
  fetch(request, env, executionCtx) {
    return app.fetch(request, env, executionCtx);
  },
} satisfies ExportedHandler<Env>;

export { app };
