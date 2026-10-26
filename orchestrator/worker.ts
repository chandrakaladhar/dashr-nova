// Temporal worker: runs workflows and activities, and sweeps the outbox.
// A separate process from the Next.js server: `npm run worker`.
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/project-provisioning";
import { getConfig } from "../lib/config";
import { dispatchPending } from "../lib/outbox";
import { TASK_QUEUE } from "../lib/temporal/shared";

const SWEEP_INTERVAL_MS = 15_000;

async function main() {
  const config = getConfig();
  if (!config.TEMPORAL_ENABLED || !config.TEMPORAL_ADDRESS) throw new Error("TEMPORAL_ADDRESS is required for the worker");

  const connection = await NativeConnection.connect({ address: config.TEMPORAL_ADDRESS });
  const worker = await Worker.create({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve("./workflows"),
    activities,
  });

  // Starts workflows the API could not (crash, Temporal down). Safe to run in
  // every worker replica: rows are claimed with SKIP LOCKED.
  const sweeper = setInterval(() => {
    dispatchPending()
      .then((n) => n && console.log(`outbox: started ${n} pending workflow(s)`))
      .catch((err) => console.error("outbox sweep failed:", (err as Error).message));
  }, SWEEP_INTERVAL_MS);

  try {
    await worker.run(); // until SIGINT/SIGTERM
  } finally {
    clearInterval(sweeper);
    await connection.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
