function delay(ms: number, value: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

async function main() {
  const started = Date.now();
  const values = await Promise.all([
    delay(20, "a"),
    delay(20, "b"),
    delay(20, "c"),
  ]);

  console.log(
    JSON.stringify({
      values,
      elapsedMs: Date.now() - started,
    }),
  );
}

await main();

export {};
