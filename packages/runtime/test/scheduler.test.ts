import { describe, expect, it } from "vitest";
import { HttpError } from "../../http/src/index";
import {
  createRequestScheduler,
  type RequestSchedulerOptions,
} from "../src/index";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await Promise.resolve();
}

describe("RequestScheduler", () => {
  it("starts requests immediately while capacity is available", async () => {
    const scheduler = createRequestScheduler({ maxConcurrentRequests: 2 });
    let started = 0;

    const first = scheduler.run(async () => {
      started += 1;
      return "first";
    });
    const second = scheduler.run(async () => {
      started += 1;
      return "second";
    });

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(started).toBe(2);
  });

  it("queues overflow requests in FIFO order", async () => {
    const scheduler = createRequestScheduler({
      maxConcurrentRequests: 1,
      requestQueueLimit: 2,
    });
    const blocker = deferred<string>();
    const events: string[] = [];

    const first = scheduler.run(async () => {
      events.push("first:start");
      return blocker.promise;
    });
    const second = scheduler.run(async () => {
      events.push("second:start");
      return "second";
    });
    const third = scheduler.run(async () => {
      events.push("third:start");
      return "third";
    });

    await flush();
    expect(events).toEqual(["first:start"]);

    blocker.resolve("first");

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    await expect(third).resolves.toBe("third");
    expect(events).toEqual(["first:start", "second:start", "third:start"]);
  });

  it("returns busy errors when the queue is full", async () => {
    const scheduler = createRequestScheduler({
      maxConcurrentRequests: 1,
      requestQueueLimit: 1,
      rejectCode: "FORGETS_BUSY",
      rejectMessage: "Server Busy",
      rejectStatus: 503,
    });
    const blocker = deferred<void>();

    const first = scheduler.run(async () => blocker.promise);
    const second = scheduler.run(async () => "queued");
    const third = scheduler.run(async () => "rejected");

    await expect(third).resolves.toMatchObject({
      name: "HttpError",
      status: 503,
      code: "FORGETS_BUSY",
      message: "Server Busy",
    });

    blocker.resolve();
    await first;
    await expect(second).resolves.toBe("queued");
  });

  it("expires queued requests after queueTimeoutMs", async () => {
    const scheduler = createRequestScheduler({
      maxConcurrentRequests: 1,
      requestQueueLimit: 1,
      queueTimeoutMs: 1,
      rejectCode: "FORGETS_BUSY",
      rejectMessage: "Server Busy",
      rejectStatus: 503,
    });
    const blocker = deferred<void>();

    const first = scheduler.run(async () => blocker.promise);
    const queued = scheduler.run(async () => "queued");

    await expect(queued).resolves.toMatchObject({
      name: "HttpError",
      status: 503,
      code: "FORGETS_BUSY",
    });

    blocker.resolve();
    await first;
  });

  it("releases capacity after a task rejects", async () => {
    const scheduler = createRequestScheduler({
      maxConcurrentRequests: 1,
      requestQueueLimit: 1,
    });
    const events: string[] = [];

    const first = scheduler.run(async () => {
      events.push("first:start");
      throw new Error("boom");
    });
    const second = scheduler.run(async () => {
      events.push("second:start");
      return "second";
    });

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("second");
    expect(events).toEqual(["first:start", "second:start"]);
  });

  it("uses HttpError for busy responses", async () => {
    const options: RequestSchedulerOptions = {
      maxConcurrentRequests: 0,
      requestQueueLimit: 0,
    };
    const scheduler = createRequestScheduler(options);

    const response = await scheduler.run(async () => "never");

    expect(response).toBeInstanceOf(HttpError);
  });
});
