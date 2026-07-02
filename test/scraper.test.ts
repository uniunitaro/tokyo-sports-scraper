import { describe, expect, it } from 'vitest';
import { scrapeAvailability } from '../src/scraper';

const encoder = new TextEncoder();

describe('scrapeAvailability', () => {
  it('scrapes and normalizes availability through the ajax flow', async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = String(init?.body ?? '');
      calls.push(`${init?.method ?? 'GET'} ${url} ${body}`);

      if (url.endsWith('/index.jsp')) {
        return response('<html></html>', {
          'set-cookie': 'JSESSIONID=test; Path=/web',
        });
      }

      if (url.endsWith('/rsvWTransFavorite2InfoBuildAjaxAction.do')) {
        const category = body.includes('selectPpsCd=1010') ? 'small' : 'normal';
        return jsonResponse({
          all: 1,
          results: [
            { bcd: category === 'small' ? '1090' : '1020', bcdNm: '砧公園' },
          ],
        });
      }

      if (url.endsWith('/rsvWOpeInstSrchVacantAction.do')) {
        return response('<select id="facility-select"></select>');
      }

      if (url.endsWith('/rsvWOpeInstSrchVacantBuildAjaxAction.do')) {
        return jsonResponse({
          results: [{ penaltyday: '7', icd: '10200010', iname: '野球場' }],
        });
      }

      if (url.endsWith('/rsvWOpeInstSrchVacantAjaxAction.do')) {
        return jsonResponse({
          result: [
            {
              tzoneNo: 10,
              tzoneName: '９時',
              timeResult: [
                {
                  rsvNum: 2,
                  alt: '空き',
                  startTime: 900,
                  endTime: 1100,
                  useDay: 20260706,
                  status: 0,
                },
                {
                  rsvNum: 0,
                  alt: '予約あり',
                  startTime: 1100,
                  endTime: 1300,
                  useDay: 20260706,
                  status: 210,
                },
              ],
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    };

    const snapshot = await scrapeAvailability({
      fetcher: fetcher as typeof fetch,
      today: '2026-07-02',
    });

    expect(snapshot.errors).toEqual([]);
    expect(snapshot.parks).toHaveLength(2);
    expect(snapshot.facilities).toHaveLength(2);
    expect(snapshot.slots.some((slot) => slot.available)).toBe(true);
    expect(snapshot.slots[0]).toMatchObject({
      date: '2026-07-06',
      startTime: '09:00',
      endTime: '11:00',
      availableCount: 2,
    });
    expect(calls.some((call) => call.includes('useDay=20260730'))).toBe(true);
  });
});

const response = (body: string, headers: Record<string, string> = {}) =>
  new Response(encoder.encode(body), {
    status: 200,
    headers,
  });

const jsonResponse = (value: unknown) =>
  response(JSON.stringify(value), {
    'content-type': 'application/json;charset=Windows-31J',
  });
