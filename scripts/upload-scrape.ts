import { getErrorMessage, withRetry } from '../src/fetch-utils';
import { scrapeAvailability } from '../src/scraper';
import type { AvailabilitySnapshot } from '../src/types';

const main = async () => {
  const ingestUrl = getIngestUrl();
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    throw new Error('ADMIN_TOKEN is required');
  }

  const startedAt = Date.now();
  const snapshot = await scrapeAvailability();
  const scrapeElapsedMs = Date.now() - startedAt;

  await uploadSnapshot(ingestUrl, adminToken, snapshot);

  const availableSlots = snapshot.slots.filter((slot) => slot.available).length;
  console.log(
    JSON.stringify(
      {
        ok: snapshot.ok,
        checkedAt: snapshot.checkedAt,
        scrapeElapsedMs,
        parks: snapshot.parks.length,
        facilities: snapshot.facilities.length,
        slots: snapshot.slots.length,
        availableSlots,
        errors: snapshot.errors.length,
      },
      null,
      2,
    ),
  );

  if (!snapshot.ok) {
    process.exitCode = 1;
  }
};

const uploadSnapshot = async (
  ingestUrl: string,
  adminToken: string,
  snapshot: AvailabilitySnapshot,
) =>
  withRetry(
    async () => {
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `upload failed: ${response.status} ${response.statusText} ${body}`,
        );
      }
    },
    {
      attempts: 3,
      baseDelayMs: 1000,
      label: 'upload availability snapshot',
    },
  );

const getIngestUrl = () => {
  if (process.env.WORKER_INGEST_URL) {
    return process.env.WORKER_INGEST_URL;
  }
  if (process.env.WORKER_URL) {
    return `${process.env.WORKER_URL.replace(/\/$/, '')}/admin/availability`;
  }
  throw new Error('WORKER_INGEST_URL or WORKER_URL is required');
};

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
