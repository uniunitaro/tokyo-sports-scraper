import { describe, expect, it, vi } from 'vitest';
import { AVAILABILITY_LATEST_KEY } from '../src/constants';
import { app } from '../src/index';
import type { AvailabilitySnapshot, Env } from '../src/types';
import { formatDisplayDate } from '../src/ui';

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

  it('filters available slots by date and field', async () => {
    const kv = createMemoryKv();
    const snapshot = createSnapshot({
      slots: [
        {
          category: '野球',
          parkCode: '1001',
          parkName: 'A公園',
          facilityCode: 'a-field',
          facilityName: '野球場',
          date: '2000-01-01',
          startTime: '09:00',
          endTime: '11:00',
          status: 0,
          statusText: '空き',
          availableCount: 1,
          available: true,
        },
        {
          category: '野球',
          parkCode: '1002',
          parkName: 'B公園',
          facilityCode: 'b-field',
          facilityName: '野球場',
          date: '2000-01-02',
          startTime: '11:00',
          endTime: '13:00',
          status: 0,
          statusText: '空き',
          availableCount: 2,
          available: true,
        },
      ],
    });
    await kv.put(AVAILABILITY_LATEST_KEY, JSON.stringify(snapshot));

    const response = await app.request(
      '/?date=2000-01-01&field=%E9%87%8E%E7%90%83%3A1001%3Aa-field',
      {},
      createEnv(kv),
    );
    const html = await response.text();

    expect(html).toContain('2000/1/1（土）');
    expect(html).toContain('A公園');
    expect(html).not.toContain('B公園</td>');
  });
});

describe('formatDisplayDate', () => {
  it('formats an ISO date with the Japanese weekday', () => {
    expect(formatDisplayDate('2000-01-01')).toBe('2000/1/1（土）');
  });
});

const createSnapshot = (
  overrides: Partial<AvailabilitySnapshot> = {},
): AvailabilitySnapshot => ({
  checkedAt: '2026-07-02T00:00:00.000Z',
  startedAt: '2026-07-02T00:00:00.000Z',
  finishedAt: '2026-07-02T00:00:01.000Z',
  ok: true,
  categories: [],
  parks: [],
  facilities: [],
  slots: [],
  errors: [],
  ...overrides,
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
