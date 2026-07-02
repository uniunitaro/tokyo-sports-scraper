import { fetchWithTimeout, getErrorMessage, withRetry } from './fetch-utils';
import type { Env } from './types';

type DispatchScrapeWorkflowResult = {
  ok: true;
  owner: string;
  repo: string;
  workflowId: string;
  ref: string;
};

const dispatchScrapeWorkflow = async (
  env: Env,
): Promise<DispatchScrapeWorkflowResult> => {
  const token = env.SCRAPE_WORKFLOW_DISPATCH_TOKEN;
  if (!token) {
    throw new Error('SCRAPE_WORKFLOW_DISPATCH_TOKEN is not configured');
  }

  const owner = env.SCRAPE_WORKFLOW_OWNER || 'uniunitaro';
  const repo = env.SCRAPE_WORKFLOW_REPO || 'tokyo-sports-scraper';
  const workflowId = env.SCRAPE_WORKFLOW_ID || 'scrape.yml';
  const ref = env.SCRAPE_WORKFLOW_REF || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

  await withRetry(
    async () => {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'user-agent': 'tokyo-sports-scraper-worker',
          'x-github-api-version': '2022-11-28',
        },
        body: JSON.stringify({ ref }),
        timeoutMs: 30_000,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `GitHub workflow dispatch failed: ${response.status} ${response.statusText} ${body}`,
        );
      }
    },
    {
      attempts: 3,
      baseDelayMs: 1000,
      label: 'dispatch scrape workflow',
    },
  );

  return {
    ok: true,
    owner,
    repo,
    workflowId,
    ref,
  };
};

const logDispatchError = (label: string, error: unknown) => {
  console.log(label, { reason: getErrorMessage(error) });
};

export type { DispatchScrapeWorkflowResult };
export { dispatchScrapeWorkflow, logDispatchError };
