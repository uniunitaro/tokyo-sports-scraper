type TargetCategory = {
  label: string;
  purposeClassCode: string;
  purposeCode: string;
  purposeValue: string;
};

type Park = {
  category: string;
  code: string;
  name: string;
};

type Facility = {
  category: string;
  parkCode: string;
  parkName: string;
  code: string;
  name: string;
  penaltyDays: number | null;
};

type AvailabilitySlot = {
  category: string;
  parkCode: string;
  parkName: string;
  facilityCode: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: number;
  statusText: string;
  availableCount: number;
  available: boolean;
};

type ScrapeError = {
  category?: string;
  parkCode?: string;
  parkName?: string;
  facilityCode?: string;
  facilityName?: string;
  step: string;
  message: string;
};

type AvailabilitySnapshot = {
  checkedAt: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  categories: TargetCategory[];
  parks: Park[];
  facilities: Facility[];
  slots: AvailabilitySlot[];
  errors: ScrapeError[];
};

type ScrapeStoreResult =
  | {
      status: 'stored';
      snapshot: AvailabilitySnapshot;
    }
  | {
      status: 'locked';
    };

type Env = {
  AVAILABILITY_KV: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_TOKEN?: string;
};

export type {
  AvailabilitySlot,
  AvailabilitySnapshot,
  Env,
  Facility,
  Park,
  ScrapeError,
  ScrapeStoreResult,
  TargetCategory,
};
