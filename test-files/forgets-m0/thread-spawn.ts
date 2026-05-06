import { parallelMap, spawn } from "perry/thread";

const task = spawn(() => {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    total += i;
  }
  return total;
});

const doubled = parallelMap([1, 2, 3, 4], (value: number) => value * 2);
const total = await task;

console.log(JSON.stringify({
  total,
  doubled,
}));
