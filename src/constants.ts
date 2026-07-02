import type { TargetCategory } from './types';

const BASE_URL = 'https://kouen.sports.metro.tokyo.lg.jp';
const WEB_BASE_URL = `${BASE_URL}/web`;

const TARGET_CATEGORIES = [
  {
    label: '野球',
    purposeClassCode: '1000',
    purposeCode: '1000',
    purposeValue: '1000_1000',
  },
  {
    label: '野球（小）',
    purposeClassCode: '1000',
    purposeCode: '1010',
    purposeValue: '1000_1010',
  },
] satisfies TargetCategory[];

const AVAILABILITY_LATEST_KEY = 'availability:latest';
const SCRAPE_LOCK_KEY = 'scrape:lock';
const SCRAPE_LOCK_TTL_SECONDS = 14 * 60;

export {
  AVAILABILITY_LATEST_KEY,
  BASE_URL,
  SCRAPE_LOCK_KEY,
  SCRAPE_LOCK_TTL_SECONDS,
  TARGET_CATEGORIES,
  WEB_BASE_URL,
};
