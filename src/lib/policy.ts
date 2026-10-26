import { getConfig } from "./config";
import { DependencyUnavailable } from "./errors";

/**
 * Evaluate an OPA decision, e.g. evaluate("dashr/project/create/decision", input).
 *
 * Unlike isAllowed (lib/opa.ts), this returns structured decisions and throws
 * DependencyUnavailable when OPA cannot answer, including when the decision
 * is undefined (bundle not loaded, wrong path). Callers must never treat a
 * throw as allow; in workflows the activity is retried.
 */
export async function evaluate<T>(path: string, input: unknown): Promise<T> {
  const config = getConfig();
  if (!config.OPA_ENABLED || !config.OPA_URL) throw new DependencyUnavailable("OPA (disabled)");
  let res: Response;
  try {
    res = await fetch(`${config.OPA_URL}/v1/data/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new DependencyUnavailable("OPA", err);
  }
  if (!res.ok) throw new DependencyUnavailable(`OPA (HTTP ${res.status})`);
  const body = (await res.json()) as { result?: T; decision_id?: string };
  if (body.result === undefined) throw new DependencyUnavailable(`OPA (no decision at ${path})`);
  return body.result;
}
