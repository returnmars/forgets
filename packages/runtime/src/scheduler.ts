import { HttpError } from "../../http/src/index";

export interface RequestSchedulerOptions {
  maxConcurrentRequests?: number;
  requestQueueLimit?: number;
  queueTimeoutMs?: number;
  rejectStatus?: number;
  rejectCode?: string;
  rejectMessage?: string;
}

export interface ResolvedRequestSchedulerOptions {
  maxConcurrentRequests: number;
  requestQueueLimit: number;
  queueTimeoutMs: number;
  rejectStatus: number;
  rejectCode: string;
  rejectMessage: string;
}

export interface RequestScheduler {
  readonly active: number;
  readonly queued: number;
  readonly options: ResolvedRequestSchedulerOptions;
  run<T>(task: () => Promise<T> | T): Promise<T | HttpError>;
}

export const defaultRequestSchedulerOptions: ResolvedRequestSchedulerOptions = {
  maxConcurrentRequests: 1024,
  requestQueueLimit: 1024,
  queueTimeoutMs: 30000,
  rejectStatus: 503,
  rejectCode: "FORGETS_BUSY",
  rejectMessage: "Server Busy",
};

interface QueuedTask<T> {
  task: () => Promise<T> | T;
  resolve(value: T | HttpError | PromiseLike<T | HttpError>): void;
  reject(reason?: unknown): void;
  timer?: ReturnType<typeof setTimeout>;
}

export function createRequestScheduler(
  options: RequestSchedulerOptions = {},
): RequestScheduler {
  return new DefaultRequestScheduler(resolveRequestSchedulerOptions(options));
}

export function resolveRequestSchedulerOptions(
  options: RequestSchedulerOptions = {},
): ResolvedRequestSchedulerOptions {
  return {
    maxConcurrentRequests: nonNegativeInteger(
      options.maxConcurrentRequests,
      defaultRequestSchedulerOptions.maxConcurrentRequests,
    ),
    requestQueueLimit: nonNegativeInteger(
      options.requestQueueLimit,
      defaultRequestSchedulerOptions.requestQueueLimit,
    ),
    queueTimeoutMs: nonNegativeInteger(
      options.queueTimeoutMs,
      defaultRequestSchedulerOptions.queueTimeoutMs,
    ),
    rejectStatus: httpStatus(
      options.rejectStatus,
      defaultRequestSchedulerOptions.rejectStatus,
    ),
    rejectCode: nonEmptyString(
      options.rejectCode,
      defaultRequestSchedulerOptions.rejectCode,
    ),
    rejectMessage: nonEmptyString(
      options.rejectMessage,
      defaultRequestSchedulerOptions.rejectMessage,
    ),
  };
}

class DefaultRequestScheduler implements RequestScheduler {
  readonly options: ResolvedRequestSchedulerOptions;
  #active = 0;
  #queue: Array<QueuedTask<unknown>> = [];

  constructor(options: ResolvedRequestSchedulerOptions) {
    this.options = options;
  }

  get active(): number {
    return this.#active;
  }

  get queued(): number {
    return this.#queue.length;
  }

  run<T>(task: () => Promise<T> | T): Promise<T | HttpError> {
    if (this.#active < this.options.maxConcurrentRequests) {
      return this.#start(task);
    }

    if (this.#queue.length >= this.options.requestQueueLimit) {
      return Promise.resolve(this.#busyError());
    }

    return new Promise<T | HttpError>((resolve, reject) => {
      const queued: QueuedTask<T> = {
        task,
        resolve,
        reject,
      };

      if (this.options.queueTimeoutMs >= 0) {
        queued.timer = setTimeout(() => {
          this.#expire(queued);
        }, this.options.queueTimeoutMs);
      }

      this.#queue.push(queued as QueuedTask<unknown>);
    });
  }

  #start<T>(task: () => Promise<T> | T): Promise<T> {
    this.#active += 1;

    return Promise.resolve()
      .then(task)
      .finally(() => {
        this.#active -= 1;
        this.#drain();
      });
  }

  #drain(): void {
    while (
      this.#active < this.options.maxConcurrentRequests &&
      this.#queue.length > 0
    ) {
      const queued = this.#queue.shift();

      if (!queued) {
        return;
      }

      if (queued.timer) {
        clearTimeout(queued.timer);
      }

      this.#start(queued.task).then(queued.resolve, queued.reject);
    }
  }

  #expire<T>(queued: QueuedTask<T>): void {
    const index = this.#queue.indexOf(queued as QueuedTask<unknown>);
    if (index < 0) {
      return;
    }

    this.#queue.splice(index, 1);
    queued.resolve(this.#busyError());
  }

  #busyError(): HttpError {
    return new HttpError(this.options.rejectStatus, this.options.rejectMessage, {
      code: this.options.rejectCode,
    });
  }
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function httpStatus(value: unknown, fallback: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 400 ||
    value > 599
  ) {
    return fallback;
  }

  return Math.floor(value);
}

function nonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  return value;
}
