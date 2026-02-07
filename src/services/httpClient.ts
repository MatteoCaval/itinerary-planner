export class ApiError extends Error {
  status: number | null;
  code: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number | null; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status ?? null;
    this.code = options?.code ?? 'unknown_error';
    this.details = options?.details;
  }
}

export interface FetchJsonOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

const isRetriableStatus = (status: number) => status === 429 || status >= 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parseErrorBody = async (response: Response): Promise<unknown> => {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch {
    return undefined;
  }
};

const mergeSignals = (signalA?: AbortSignal | null, signalB?: AbortSignal | null) => {
  if (!signalA && !signalB) return undefined;
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  signalA?.addEventListener('abort', onAbort, { once: true });
  signalB?.addEventListener('abort', onAbort, { once: true });

  if (signalA?.aborted || signalB?.aborted) {
    controller.abort();
  }

  return controller.signal;
};

export const fetchJson = async <T>(url: string, options: FetchJsonOptions = {}): Promise<T> => {
  const {
    retries = 1,
    retryDelayMs = 500,
    timeoutMs = 15000,
    signal,
    ...init
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const mergedSignal = mergeSignals(signal, timeoutController.signal);
      const response = await fetch(url, { ...init, signal: mergedSignal });

      if (!response.ok) {
        const details = await parseErrorBody(response);
        const shouldRetry = attempt < retries && isRetriableStatus(response.status);

        if (shouldRetry) {
          await sleep(retryDelayMs * (attempt + 1));
          attempt += 1;
          continue;
        }

        throw new ApiError(`Request failed with status ${response.status}`, {
          status: response.status,
          code: 'http_error',
          details,
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new ApiError('Expected JSON response', {
          status: response.status,
          code: 'invalid_content_type',
        });
      }

      return await response.json() as T;
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      const retriable = !aborted && !(error instanceof ApiError);

      if (attempt < retries && retriable) {
        await sleep(retryDelayMs * (attempt + 1));
        attempt += 1;
        continue;
      }

      if (error instanceof ApiError) throw error;

      if (aborted) {
        throw new ApiError('Request timed out or was aborted', { code: 'request_aborted' });
      }

      throw new ApiError('Network request failed', { code: 'network_error', details: error });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new ApiError('Request failed after retries', { code: 'retry_exhausted' });
};
