import { TARGET_CATEGORIES } from './constants';
import {
  addMonthsClamped,
  buildWeekStartDates,
  formatTime,
  fromYmd,
  toIsoDateInJst,
} from './date-utils';
import { type FetchLike, getErrorMessage, withRetry } from './fetch-utils';
import { TokyoSportsClient, type WeekApiResponse } from './tokyo-sports-client';
import type {
  AvailabilitySlot,
  AvailabilitySnapshot,
  Facility,
  Park,
  ScrapeError,
  TargetCategory,
} from './types';

type ScrapeOptions = {
  fetcher?: FetchLike;
  today?: string;
};

type ParkScrapeResult = {
  facilities: Facility[];
  slots: AvailabilitySlot[];
  errors: ScrapeError[];
};

const PARK_CONCURRENCY = 3;

const scrapeAvailability = async (
  options: ScrapeOptions = {},
): Promise<AvailabilitySnapshot> => {
  const startedAt = new Date().toISOString();
  const today = options.today ?? toIsoDateInJst();
  const endDate = addMonthsClamped(today, 1);
  const weekStartDates = buildWeekStartDates(today, endDate);

  const parks: Park[] = [];
  const facilities: Facility[] = [];
  const slots: AvailabilitySlot[] = [];
  const errors: ScrapeError[] = [];

  for (const category of TARGET_CATEGORIES) {
    const categoryClient = new TokyoSportsClient({ fetcher: options.fetcher });
    let categoryParks: Park[] = [];
    try {
      await categoryClient.initializeSession();
      categoryParks = await withRetry(
        () => categoryClient.fetchParks(category),
        {
          attempts: 3,
          label: `${category.label}:parks`,
        },
      );
      parks.push(...categoryParks);
    } catch (error) {
      errors.push({
        category: category.label,
        step: 'parks',
        message: getErrorMessage(error),
      });
      continue;
    }

    const results = await mapWithConcurrency(
      categoryParks,
      PARK_CONCURRENCY,
      async (park): Promise<ParkScrapeResult> => {
        try {
          const result = await scrapePark({
            category,
            park,
            today,
            weekStartDates,
            fetcher: options.fetcher,
          });
          return {
            facilities: result.facilities,
            slots: result.slots,
            errors: [],
          };
        } catch (error) {
          return {
            facilities: [],
            slots: [],
            errors: [
              {
                category: category.label,
                parkCode: park.code,
                parkName: park.name,
                step: 'park',
                message: getErrorMessage(error),
              },
            ],
          };
        }
      },
    );

    for (const result of results) {
      facilities.push(...result.facilities);
      slots.push(...result.slots);
      errors.push(...result.errors);
    }
  }

  const finishedAt = new Date().toISOString();
  return {
    checkedAt: finishedAt,
    startedAt,
    finishedAt,
    ok: errors.length === 0,
    categories: TARGET_CATEGORIES,
    parks,
    facilities,
    slots: slots
      .filter((slot) => slot.date >= today && slot.date <= endDate)
      .sort(sortSlots),
    errors,
  };
};

const mapWithConcurrency = async <T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const value = values[currentIndex];
        if (value === undefined) {
          continue;
        }
        results[currentIndex] = await mapper(value, currentIndex);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

const scrapePark = async ({
  category,
  park,
  today,
  weekStartDates,
  fetcher,
}: {
  category: TargetCategory;
  park: Park;
  today: string;
  weekStartDates: string[];
  fetcher?: FetchLike;
}) =>
  withRetry(
    async () => {
      const client = new TokyoSportsClient({ fetcher });
      await client.initializeSession();
      await client.searchPark(category, park.code, today);
      const rawFacilities = await client.fetchFacilities(park.code);

      const facilities: Facility[] = rawFacilities.map((facility) => ({
        category: category.label,
        parkCode: park.code,
        parkName: park.name,
        code: facility.icd,
        name: facility.iname,
        penaltyDays: facility.penaltyday ? Number(facility.penaltyday) : null,
      }));
      const slots: AvailabilitySlot[] = [];

      for (const facility of facilities) {
        for (const weekStartDate of weekStartDates) {
          const week = await withRetry(
            () => client.fetchWeek(park.code, facility.code, weekStartDate),
            {
              attempts: 3,
              label: `${category.label}:${park.name}:${facility.name}:${weekStartDate}`,
              baseDelayMs: 750,
            },
          );
          slots.push(...normalizeWeek(category, park, facility, week));
        }
      }

      return { facilities, slots };
    },
    {
      attempts: 3,
      label: `${category.label}:${park.name}`,
      baseDelayMs: 1_000,
    },
  );

const normalizeWeek = (
  category: TargetCategory,
  park: Park,
  facility: Facility,
  week: WeekApiResponse,
) => {
  const slots: AvailabilitySlot[] = [];
  for (const row of week.result ?? []) {
    for (const cell of row.timeResult) {
      const availableCount = Number(cell.rsvNum) || 0;
      slots.push({
        category: category.label,
        parkCode: park.code,
        parkName: park.name,
        facilityCode: facility.code,
        facilityName: facility.name,
        date: fromYmd(cell.useDay),
        startTime: formatTime(cell.startTime),
        endTime: formatTime(cell.endTime),
        status: cell.status,
        statusText: cell.alt,
        availableCount,
        available: cell.status === 0 && availableCount > 0,
      });
    }
  }
  return slots;
};

const sortSlots = (a: AvailabilitySlot, b: AvailabilitySlot) =>
  a.date.localeCompare(b.date) ||
  a.parkName.localeCompare(b.parkName, 'ja') ||
  a.facilityName.localeCompare(b.facilityName, 'ja') ||
  a.startTime.localeCompare(b.startTime) ||
  a.category.localeCompare(b.category, 'ja');

export { scrapeAvailability };
