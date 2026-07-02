import {
  AVAILABILITY_LATEST_KEY,
  SCRAPE_LOCK_KEY,
  SCRAPE_LOCK_TTL_SECONDS,
} from './constants';
import { scrapeAvailability } from './scraper';
import type { AvailabilitySnapshot, Env, ScrapeStoreResult } from './types';

const loadLatestSnapshot = async (kv: KVNamespace) =>
  kv.get<AvailabilitySnapshot>(AVAILABILITY_LATEST_KEY, 'json');

const saveLatestSnapshot = async (
  kv: KVNamespace,
  snapshot: AvailabilitySnapshot,
) =>
  kv.put(AVAILABILITY_LATEST_KEY, JSON.stringify(snapshot), {
    metadata: {
      checkedAt: snapshot.checkedAt,
      ok: snapshot.ok,
    },
  });

const runScrapeAndStore = async (
  env: Env,
  options: {
    force?: boolean;
  } = {},
): Promise<ScrapeStoreResult> => {
  if (!options.force) {
    const lock = await env.AVAILABILITY_KV.get(SCRAPE_LOCK_KEY);
    if (lock) {
      return { status: 'locked' };
    }
  }

  await env.AVAILABILITY_KV.put(SCRAPE_LOCK_KEY, new Date().toISOString(), {
    expirationTtl: SCRAPE_LOCK_TTL_SECONDS,
  });

  try {
    const snapshot = await scrapeAvailability();
    await saveLatestSnapshot(env.AVAILABILITY_KV, snapshot);
    return {
      status: 'stored',
      snapshot,
    };
  } finally {
    await env.AVAILABILITY_KV.delete(SCRAPE_LOCK_KEY);
  }
};

export { loadLatestSnapshot, runScrapeAndStore, saveLatestSnapshot };
