import type { PoolClient } from "pg";
import { getPool } from "./db";
import { startProjectProvisioning } from "./temporal/client";

// Transactional outbox. Domain functions call enqueue() inside their own
// transaction; after commit they call dispatch() for a fast start, and the
// worker's sweeper (dispatchPending) retries anything that did not start,
// e.g. because the API crashed or Temporal was down.

type OutboxEvent = { kind: "project.provision"; payload: { projectId: string } };

export async function enqueue(tx: PoolClient, event: OutboxEvent): Promise<number> {
  const { rows } = await tx.query<{ id: string }>(
    "insert into outbox (kind, payload) values ($1, $2) returning id",
    [event.kind, event.payload],
  );
  return Number(rows[0].id);
}

async function handle(event: OutboxEvent): Promise<void> {
  switch (event.kind) {
    case "project.provision":
      return startProjectProvisioning(event.payload.projectId);
  }
}

/** Best effort, right after commit. Failures are left for the sweeper. */
export async function dispatch(id: number, event: OutboxEvent): Promise<void> {
  try {
    await handle(event);
    await getPool().query("update outbox set dispatched_at = now() where id = $1", [id]);
  } catch (err) {
    console.warn(`outbox ${id}: dispatch deferred to sweeper:`, (err as Error).message);
  }
}

/**
 * Sweeper, run periodically by the worker. Picks up events older than
 * `minAgeSeconds` (so it doesn't race the API's own dispatch). SKIP LOCKED
 * lets several workers sweep without double-dispatching.
 */
export async function dispatchPending(limit = 20, minAgeSeconds = 30): Promise<number> {
  const client = await getPool().connect();
  let dispatched = 0;
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string; kind: OutboxEvent["kind"]; payload: OutboxEvent["payload"] }>(
      `select id, kind, payload from outbox
        where dispatched_at is null and created_at < now() - make_interval(secs => $2)
        order by id limit $1 for update skip locked`,
      [limit, minAgeSeconds],
    );
    for (const row of rows) {
      try {
        await handle({ kind: row.kind, payload: row.payload });
        await client.query("update outbox set dispatched_at = now() where id = $1", [row.id]);
        dispatched++;
      } catch (err) {
        await client.query("update outbox set attempts = attempts + 1, last_error = $2 where id = $1", [
          row.id,
          (err as Error).message,
        ]);
      }
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return dispatched;
}
