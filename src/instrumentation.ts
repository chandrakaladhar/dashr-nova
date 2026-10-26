// Runs once when the Next.js server starts. Validating here makes a
// misconfigured pod fail immediately with a clear message, instead of
// failing later on the first request that needs a dependency.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getConfig } = await import("./lib/config");
    try {
      getConfig();
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  }
}
