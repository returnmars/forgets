declare module "perry/thread" {
  export function spawn<T>(fn: () => T): Promise<T>;
  export function parallelMap<T, R>(items: T[], fn: (value: T) => R): R[];
}
