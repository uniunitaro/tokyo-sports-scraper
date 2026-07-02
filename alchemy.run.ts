import path from 'node:path';
import { fileURLToPath } from 'node:url';
import alchemy from 'alchemy';
import { Assets, KVNamespace, Worker } from 'alchemy/cloudflare';
import { CloudflareStateStore } from 'alchemy/state';

const shouldUseStateStore =
  process.env.NODE_ENV === 'production' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  Boolean(process.env.ALCHEMY_STATE_TOKEN);

const app = await alchemy('tokyo-sports-scraper', {
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: shouldUseStateStore
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});

const appDir = path.dirname(fileURLToPath(import.meta.url));
const secret = (value: string | undefined) => {
  if (!value) {
    return '';
  }
  return shouldUseStateStore ? alchemy.secret(value) : value;
};

const availabilityKv = await KVNamespace('availability', {
  title: 'tokyo-sports-scraper-availability',
});

const staticAssets = await Assets({
  path: path.join(appDir, 'assets'),
});

export const worker = await Worker('worker', {
  entrypoint: path.join(appDir, 'src', 'index.tsx'),
  crons: ['*/15 * * * *'],
  assets: {
    run_worker_first: true,
    html_handling: 'none',
    not_found_handling: 'none',
  },
  bindings: {
    AVAILABILITY_KV: availabilityKv,
    ASSETS: staticAssets,
    ADMIN_TOKEN: secret(process.env.ADMIN_TOKEN),
    SCRAPE_WORKFLOW_DISPATCH_TOKEN: secret(
      process.env.SCRAPE_WORKFLOW_DISPATCH_TOKEN,
    ),
    SCRAPE_WORKFLOW_OWNER: process.env.SCRAPE_WORKFLOW_OWNER ?? 'uniunitaro',
    SCRAPE_WORKFLOW_REPO:
      process.env.SCRAPE_WORKFLOW_REPO ?? 'tokyo-sports-scraper',
    SCRAPE_WORKFLOW_ID: process.env.SCRAPE_WORKFLOW_ID ?? 'scrape.yml',
    SCRAPE_WORKFLOW_REF: process.env.SCRAPE_WORKFLOW_REF ?? 'main',
  },
  url: true,
});

console.log({ url: worker.url });

await app.finalize();
