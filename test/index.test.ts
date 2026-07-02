import { describe, expect, it, vi } from 'vitest';
import { AVAILABILITY_LATEST_KEY } from '../src/constants';
import { app } from '../src/index';
import type { AvailabilitySnapshot, Env } from '../src/types';

describe('app', () => {
  it('stores an uploaded availability snapshot', async () => {
    const kv = createMemoryKv();
    const snapshot = createSnapshot();

    const response = await app.request(
      '/admin/availability',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify(snapshot),
      },
      createEnv(kv),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      stored: true,
      slots: 0,
    });
    expect(await kv.get(AVAILABILITY_LATEST_KEY, 'json')).toEqual(snapshot);
  });

  it('rejects uploads without the admin token', async () => {
    const response = await app.request(
      '/admin/availability',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createSnapshot()),
      },
      createEnv(createMemoryKv()),
    );

    expect(response.status).toBe(401);
  });

  it('rejects invalid snapshots', async () => {
    const response = await app.request(
      '/admin/availability',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ok: true }),
      },
      createEnv(createMemoryKv()),
    );

    expect(response.status).toBe(400);
  });
});

const createSnapshot = (): AvailabilitySnapshot => ({
  checkedAt: '2026-07-02T00:00:00.000Z',
  startedAt: '2026-07-02T00:00:00.000Z',
  finishedAt: '2026-07-02T00:00:01.000Z',
  ok: true,
  categories: [],
  parks: [],
  facilities: [],
  slots: [],
  errors: [],
});

const createEnv = (kv: KVNamespace): Env => ({
  AVAILABILITY_KV: kv,
  ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
  ADMIN_TOKEN: 'test-token',
});

const createMemoryKv = () => {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key) ?? null;
      if (type === 'json' && value) {
        return JSON.parse(value);
      }
      return value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace;
};
