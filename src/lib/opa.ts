import { getConfig } from "./config";

/**
 * Ask OPA for a decision. Returns false on any error (fail closed).
 * Example: await isAllowed({ user: { roles: ["researcher"] }, action: "read" })
 */
export async function isAllowed(input: Record<string, unknown>): Promise<boolean> {
  const config = getConfig();
  if (!config.OPA_ENABLED || !config.OPA_URL) return false;
  try {
    const res = await fetch(`${config.OPA_URL}/v1/data/${config.OPA_POLICY_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { result?: unknown };
    return body.result === true;
  } catch {
    return false;
  }
}
