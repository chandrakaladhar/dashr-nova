import net from "node:net";
import { getConfig } from "./config";
import { getPool } from "./db";

export type DependencyStatus = "ok" | "disabled" | "unreachable";

export interface DependencyReport {
  ok: boolean;
  database: DependencyStatus;
  temporal: DependencyStatus;
  opa: DependencyStatus;
}

async function checkDatabase(): Promise<DependencyStatus> {
  try {
    await getPool().query("select 1");
    return "ok";
  } catch {
    return "unreachable";
  }
}

// TCP reachability of the Temporal frontend. Add @temporalio/client when you
// start writing workflows; this check deliberately has no SDK dependency.
function checkTemporal(): Promise<DependencyStatus> {
  const { TEMPORAL_ENABLED, TEMPORAL_ADDRESS } = getConfig();
  if (!TEMPORAL_ENABLED || !TEMPORAL_ADDRESS) return Promise.resolve("disabled");
  const [host, port] = TEMPORAL_ADDRESS.split(":");
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: Number(port), timeout: 2_000 });
    const done = (status: DependencyStatus) => {
      socket.destroy();
      resolve(status);
    };
    socket.once("connect", () => done("ok"));
    socket.once("timeout", () => done("unreachable"));
    socket.once("error", () => done("unreachable"));
  });
}

async function checkOpa(): Promise<DependencyStatus> {
  const { OPA_ENABLED, OPA_URL } = getConfig();
  if (!OPA_ENABLED || !OPA_URL) return "disabled";
  try {
    const res = await fetch(`${OPA_URL}/health`, { signal: AbortSignal.timeout(2_000), cache: "no-store" });
    return res.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function checkDependencies(): Promise<DependencyReport> {
  const [database, temporal, opa] = await Promise.all([checkDatabase(), checkTemporal(), checkOpa()]);
  const ok = [database, temporal, opa].every((s) => s !== "unreachable");
  return { ok, database, temporal, opa };
}

export async function checkDatabaseOnly(): Promise<DependencyStatus> {
  return checkDatabase();
}
