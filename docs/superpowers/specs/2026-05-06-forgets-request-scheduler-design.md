# forgets Request Scheduler Design

> Date: 2026-05-06

## Goal

Add a first-party request admission layer to `@forgets/runtime` so forgets owns queue, backpressure, and max concurrency semantics independently of Perry's current HTTP dispatch model.

## Decisions

```txt
RequestScheduler lives in @forgets/runtime.
Fastify-backed and future raw drivers route request tasks through the scheduler.
The scheduler does not claim Perry's current Fastify-backed path executes TS route handlers concurrently.
The scheduler owns admission semantics: run, queue, reject, and queue timeout.
Native M1 continues to record ConcurrentDispatch=serial-observed until Perry/raw dispatch proves true concurrent TS route execution.
```

Default policy:

```txt
maxConcurrentRequests: 1024
requestQueueLimit: 1024
queueTimeoutMs: 30000
rejectStatus: 503
rejectCode: FORGETS_BUSY
rejectMessage: Server Busy
```

## Architecture

`RequestScheduler` is a small runtime component that accepts async request tasks. It keeps an `active` count and a FIFO queue. If `active < maxConcurrentRequests`, it starts the task immediately. If all slots are busy and the queue has capacity, it queues the task. If the queue is full, it returns a `HttpError` with the configured busy response.

Queued tasks have an optional timeout. If a queued task does not start within `queueTimeoutMs`, it is removed from the queue and resolves to the same busy error. When an active task settles, the scheduler starts the next queued task.

The scheduler returns the task's value directly. It does not normalize HTTP responses; drivers still own `Context` creation and response normalization. This keeps the scheduler independent from Fastify and raw transport details.

## Driver Integration

`createFastifyHttpDriver(app, options?)` and `createNativeHttpDriver(app, options?)` receive optional runtime settings:

```ts
interface RuntimeHttpDriverOptions {
  scheduler?: RequestScheduler;
  schedulerOptions?: RequestSchedulerOptions;
}
```

The Fastify adapter wraps `inspected.handler(ctx)` with `scheduler.run(() => inspected.handler(ctx))`. If the scheduler returns a `HttpError`, the existing response normalization path serializes it. Host-side `buildServer()` and native `listen()` use the same scheduler policy.

## Non-Goals

```txt
Do not modify Perry's Rust Fastify event_loop in this step.
Do not claim true concurrent TS route execution on the current Perry Fastify-backed path.
Do not add worker-thread CPU offload in this step.
Do not expose Fastify plugin or hook semantics.
```

## Testing

Host unit tests verify scheduler behavior without HTTP:

```txt
starts up to maxConcurrentRequests immediately
queues overflow requests FIFO
rejects when queue is full
expires queued requests after queueTimeoutMs
releases slots after task rejection
```

Driver tests verify Fastify integration with `inject()`:

```txt
driver routes handler execution through scheduler
driver returns structured 503 when scheduler rejects
```

M1 native smoke continues to verify HTTP/middleware behavior and records the current dispatch observation:

```txt
ConcurrentDispatch=serial-observed
StateIsolation=not-observed
```

## Documentation Impact

`docs/perry-compat.md` must keep the Perry source fact explicit: the current Fastify-backed native server queues requests through Perry's TS-side event loop and waits for a handler promise before processing the next pending request.

`docs/forgets-server-design.md` should describe request admission as a forgets runtime policy, not as a Perry-native concurrency guarantee.
