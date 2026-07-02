import { describe, expect, it, vi } from 'vitest';
import { AVAILABILITY_LATEST_KEY, SCRAPE_LOCK_KEY } from '../src/constants';
import { loadLatestSnapshot, saveLatestSnapshot } from '../src/storage';
import type { AvailabilitySnapshot } from '../src/types';

describe('storage', () => {
  it('saves and loads the latest snapshot', async () => {
    const kv = createMemoryKv();
    const snapshot: AvailabilitySnapshot = {
      checkedAt: '2026-07-02T00:00:00.000Z',
      startedAt: '2026-07-02T00:00:00.000Z',
      finishedAt: '2026-07-02T00:00:01.000Z',
      ok: true,
      categories: [],
      parks: [],
      facilities: [],
      slots: [],
      errors: [],
    };

    await saveLatestSnapshot(kv, snapshot);

    expect(await loadLatestSnapshot(kv)).toEqual(snapshot);
    expect(kv.put).toHaveBeenCalledWith(
      AVAILABILITY_LATEST_KEY,
      JSON.stringify(snapshot),
      expect.objectContaining({
        metadata: expect.objectContaining({ ok: true }),
      }),
    );
  });

  it('uses the expected lock key name', () => {
    expect(SCRAPE_LOCK_KEY).toBe('scrape:lock');
  });
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
