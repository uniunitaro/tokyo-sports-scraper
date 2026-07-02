import { WEB_BASE_URL } from './constants';
import { CookieJar } from './cookie-jar';
import { toYmd } from './date-utils';
import { type FetchLike, fetchWithTimeout } from './fetch-utils';
import type { TargetCategory } from './types';

type ParkApiResponse = {
  all?: number;
  results?: Array<{
    bcd: string;
    bcdNm: string;
  }>;
  ErrManager?: {
    message?: string;
  };
};

type FacilityApiResponse = {
  results?: Array<{
    penaltyday?: string;
    icd: string;
    iname: string;
  }>;
  ErrManager?: {
    message?: string;
  };
};

type WeekApiResponse = {
  result?: Array<{
    tzoneNo: number;
    tzoneName: string;
    timeResult: Array<{
      imgURL?: string;
      rsvNum: number;
      selectNum?: number;
      alt: string;
      startTime: number;
      endTime: number;
      useDay: number;
      status: number;
    }>;
  }>;
  weekDay?: Array<{
    useDay: number;
    dispWeekDay?: string;
    dispMonth?: string;
    dispDay?: string;
  }>;
  ErrManager?: {
    message?: string;
  };
};

type ClientOptions = {
  fetcher?: FetchLike;
  timeoutMs?: number;
};

class TokyoSportsClient {
  private readonly cookieJar = new CookieJar();
  private readonly fetcher: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: ClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 45_000;
  }

  async initializeSession() {
    await this.requestText('/index.jsp', {
      method: 'GET',
      referer: `${WEB_BASE_URL}/index.jsp`,
    });
  }

  async fetchParks(category: TargetCategory) {
    const json = await this.requestJson<ParkApiResponse>(
      '/rsvWTransFavorite2InfoBuildAjaxAction.do',
      {
        body: {
          displayNo: 'prwre1000',
          selectPpsdCd: category.purposeClassCode,
          selectPpsCd: category.purposeCode,
          selectAreaCd: '0',
        },
        referer: `${WEB_BASE_URL}/index.jsp`,
      },
    );
    assertNoError(json, '公園一覧取得');
    return (json.results ?? []).map((park) => ({
      category: category.label,
      code: park.bcd,
      name: park.bcdNm,
    }));
  }

  async searchPark(
    category: TargetCategory,
    parkCode: string,
    startDate: string,
  ) {
    const response = await this.requestText('/rsvWOpeInstSrchVacantAction.do', {
      method: 'POST',
      body: {
        daystarthome: startDate,
        daystart: startDate,
        selectPpsClPpscd: category.purposeValue,
        penaltyday: '7',
        dayofweekClearFlg: '1',
        timezoneClearFlg: '1',
        selectAreaBcd: parkCode,
        selectIcd: '0',
        selectPpsClsCd: category.purposeClassCode,
        selectPpsCd: category.purposeCode,
        selectBldCd: parkCode,
        displayNo: 'pawab2000',
        displayNoFrm: 'pawab2000',
      },
      referer: `${WEB_BASE_URL}/index.jsp`,
    });

    if (
      !response.includes('id="facility-select"') &&
      !response.includes("id='facility-select'")
    ) {
      throw new Error('空き状況画面へ遷移できませんでした。');
    }
  }

  async fetchFacilities(parkCode: string) {
    const json = await this.requestJson<FacilityApiResponse>(
      '/rsvWOpeInstSrchVacantBuildAjaxAction.do',
      {
        body: {
          displayNo: 'prwre1000',
          bldCd: parkCode,
        },
        referer: `${WEB_BASE_URL}/rsvWOpeInstSrchVacantAction.do`,
      },
    );
    assertNoError(json, '施設一覧取得');
    return json.results ?? [];
  }

  async fetchWeek(
    parkCode: string,
    facilityCode: string,
    weekStartDate: string,
  ) {
    const json = await this.requestJson<WeekApiResponse>(
      '/rsvWOpeInstSrchVacantAjaxAction.do',
      {
        body: {
          displayNo: 'prwrc2000',
          useDay: toYmd(weekStartDate),
          bldCd: parkCode,
          instCd: facilityCode,
          transVacantMode: '11',
          clearFlag: '0',
        },
        referer: `${WEB_BASE_URL}/rsvWOpeInstSrchVacantAction.do`,
      },
    );
    assertNoError(json, '週空き取得');
    return json;
  }

  private async requestJson<T>(
    path: string,
    options: {
      body: Record<string, string>;
      referer: string;
    },
  ) {
    const text = await this.requestText(path, {
      method: 'POST',
      body: options.body,
      referer: options.referer,
      xhr: true,
    });
    return JSON.parse(text) as T;
  }

  private async requestText(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, string>;
      referer: string;
      xhr?: boolean;
    },
  ) {
    const headers = new Headers({
      accept: options.xhr
        ? 'application/json, text/javascript, */*; q=0.01'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      referer: options.referer,
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138 Safari/537.36',
    });
    const cookieHeader = this.cookieJar.header();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
    if (options.xhr) {
      headers.set('x-requested-with', 'XMLHttpRequest');
    }

    const init: RequestInit = {
      method: options.method,
      headers,
    };
    if (options.body) {
      headers.set(
        'content-type',
        'application/x-www-form-urlencoded; charset=UTF-8',
      );
      init.body = new URLSearchParams(options.body).toString();
    }

    const response = await fetchWithTimeout(
      `${WEB_BASE_URL}${path}`,
      {
        ...init,
        timeoutMs: this.timeoutMs,
      },
      this.fetcher,
    );
    this.cookieJar.read(response.headers);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${path}`);
    }

    const bytes = await response.arrayBuffer();
    return new TextDecoder('shift_jis').decode(bytes);
  }
}

const assertNoError = (
  json: { ErrManager?: { message?: string } },
  step: string,
) => {
  if (json.ErrManager) {
    throw new Error(`${step}: ${json.ErrManager.message ?? 'システム異常'}`);
  }
};

export type { FacilityApiResponse, WeekApiResponse };
export { TokyoSportsClient };
