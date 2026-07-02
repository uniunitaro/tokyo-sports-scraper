import { TARGET_CATEGORIES } from '../src/constants';
import { addDays, toIsoDateInJst } from '../src/date-utils';
import { getErrorMessage, withRetry } from '../src/fetch-utils';
import type {
  AvailabilitySlot,
  AvailabilitySnapshot,
  Facility,
  Park,
} from '../src/types';

const LOCAL_WORKER_URL = 'http://localhost:1337';
const LOCAL_ADMIN_TOKEN = 'local-dev-token';

const main = async () => {
  const workerUrl = process.env.WORKER_URL ?? LOCAL_WORKER_URL;
  const adminToken = process.env.ADMIN_TOKEN ?? LOCAL_ADMIN_TOKEN;
  const ingestUrl =
    process.env.WORKER_INGEST_URL ??
    `${workerUrl.replace(/\/$/, '')}/admin/availability`;
  const snapshot = createDummySnapshot();

  await withRetry(
    async () => {
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `seed failed: ${response.status} ${response.statusText} ${body}`,
        );
      }
    },
    {
      attempts: 3,
      baseDelayMs: 500,
      label: 'seed local availability snapshot',
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        ingestUrl,
        checkedAt: snapshot.checkedAt,
        parks: snapshot.parks.length,
        facilities: snapshot.facilities.length,
        slots: snapshot.slots.length,
        availableSlots: snapshot.slots.filter((slot) => slot.available).length,
      },
      null,
      2,
    ),
  );
};

const createDummySnapshot = (): AvailabilitySnapshot => {
  const now = new Date().toISOString();
  const today = toIsoDateInJst();
  const parks: Park[] = [
    { category: '野球', code: 'dummy-kinuta', name: '砧公園' },
    { category: '野球', code: 'dummy-hikarigaoka', name: '光が丘公園' },
    { category: '野球（小）', code: 'dummy-musashino', name: '武蔵野公園' },
    { category: '野球（小）', code: 'dummy-shinozaki', name: '篠崎公園 A' },
  ];
  const facilities: Facility[] = [
    createFacility(parks[0], 'dummy-kinuta-field', '野球場'),
    createFacility(parks[1], 'dummy-hikarigaoka-field', '野球場'),
    createFacility(parks[2], 'dummy-musashino-small', '野球場（小）'),
    createFacility(parks[3], 'dummy-shinozaki-small', '野球場（小）'),
  ];
  const dates = [addDays(today, 1), addDays(today, 3), addDays(today, 8)];
  const slots: AvailabilitySlot[] = [
    ...createSlotsForDate(dates[0], facilities, ['09:00', '11:00', '13:00']),
    ...createSlotsForDate(dates[1], facilities, [
      '09:00',
      '11:00',
      '13:00',
      '15:00',
      '17:00',
      '19:00',
    ]),
    ...createSlotsForDate(dates[2], facilities.slice(1), [
      '11:00',
      '13:00',
      '15:00',
      '17:00',
    ]),
  ];

  return {
    checkedAt: now,
    startedAt: now,
    finishedAt: now,
    ok: true,
    categories: TARGET_CATEGORIES,
    parks,
    facilities,
    slots,
    errors: [],
  };
};

const createFacility = (
  park: Park | undefined,
  code: string,
  name: string,
): Facility => {
  if (!park) {
    throw new Error('park is required');
  }
  return {
    category: park.category,
    parkCode: park.code,
    parkName: park.name,
    code,
    name,
    penaltyDays: null,
  };
};

const createSlotsForDate = (
  date: string,
  facilities: Facility[],
  startTimes: string[],
) =>
  facilities.flatMap((facility, facilityIndex) =>
    startTimes.map((startTime, timeIndex) =>
      createSlot({
        date,
        facility,
        startTime,
        availableCount: ((facilityIndex + timeIndex) % 4) + 1,
      }),
    ),
  );

const createSlot = ({
  date,
  facility,
  startTime,
  availableCount,
}: {
  date: string;
  facility: Facility;
  startTime: string;
  availableCount: number;
}): AvailabilitySlot => ({
  category: facility.category,
  parkCode: facility.parkCode,
  parkName: facility.parkName,
  facilityCode: facility.code,
  facilityName: facility.name,
  date,
  startTime,
  endTime: addTwoHours(startTime),
  status: 0,
  statusText: '空き',
  availableCount,
  available: true,
});

const addTwoHours = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  if (hour === undefined || minute === undefined) {
    throw new Error(`Invalid time: ${time}`);
  }
  return `${String(hour + 2).padStart(2, '0')}:${String(minute).padStart(
    2,
    '0',
  )}`;
};

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
