type FetchLike = typeof fetch;

type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
};

type RetryOptions = {
  attempts: number;
  baseDelayMs?: number;
  label: string;
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {},
  fetcher: FetchLike = fetch,
) => {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const withRetry = async <T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions,
) => {
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= options.attempts) {
        break;
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.log('retrying request', {
        label: options.label,
        attempt,
        delayMs,
        reason: getErrorMessage(error),
      });
      await sleep(delayMs);
    }
  }

  throw lastError;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export type { FetchLike };
export { fetchWithTimeout, getErrorMessage, withRetry };
