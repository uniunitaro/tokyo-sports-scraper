import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchScrapeWorkflow } from '../src/github-actions';
import type { Env } from '../src/types';

describe('dispatchScrapeWorkflow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches the scrape workflow', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(dispatchScrapeWorkflow(createEnv())).resolves.toEqual({
      ok: true,
      owner: 'uniunitaro',
      repo: 'tokyo-sports-scraper',
      workflowId: 'scrape.yml',
      ref: 'main',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/uniunitaro/tokyo-sports-scraper/actions/workflows/scrape.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ref: 'main' }),
        headers: expect.objectContaining({
          authorization: 'Bearer github-token',
          'x-github-api-version': '2022-11-28',
        }),
      }),
    );
  });

  it('requires a dispatch token', async () => {
    await expect(
      dispatchScrapeWorkflow({
        ...createEnv(),
        SCRAPE_WORKFLOW_DISPATCH_TOKEN: '',
      }),
    ).rejects.toThrow('SCRAPE_WORKFLOW_DISPATCH_TOKEN is not configured');
  });
});

const createEnv = (): Env => ({
  AVAILABILITY_KV: {} as KVNamespace,
  ASSETS: {} as Fetcher,
  ADMIN_TOKEN: 'admin-token',
  SCRAPE_WORKFLOW_DISPATCH_TOKEN: 'github-token',
});
