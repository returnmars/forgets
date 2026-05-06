const controller = new AbortController();
let fired = false;

controller.signal.addEventListener("abort", () => {
  fired = true;
});

controller.abort("done");

const timeoutSignal = AbortSignal.timeout(10);

console.log(JSON.stringify({
  aborted: controller.signal.aborted,
  fired,
  timeoutInitiallyAborted: timeoutSignal.aborted,
}));
