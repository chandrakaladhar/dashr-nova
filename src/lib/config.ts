import { z } from "zod";

// The app's configuration contract. Everything comes from environment
// variables, read at RUNTIME on the server, so one image runs in every
// environment. Never use NEXT_PUBLIC_* for endpoints: those are baked into
// the browser bundle at build time.
//
// The Helm chart maps its values (database, temporal, opa) onto these names.

const flag = z.enum(["true", "false"]).default("true").transform((v) => v === "true");

const schema = z
  .object({
    // No default: development identities depend on it (REQ-AUTHZ-002).
    APP_ENV: z
      .string({ required_error: "APP_ENV is required, e.g. local, development, staging, production (chart: env.APP_ENV)" })
      .trim()
      .min(1, "APP_ENV is empty"),
    APP_VERSION: z.string().default("dev"),

    DATABASE_URL: z
      .string({ required_error: "DATABASE_URL is required (chart: database.existingSecret or database.url)" })
      .min(1, "DATABASE_URL is empty"),
    DB_POOL_MAX: z.coerce.number().int().positive().default(5),

    TEMPORAL_ENABLED: flag,
    TEMPORAL_ADDRESS: z.string().optional(),
    TEMPORAL_NAMESPACE: z.string().default("default"),

    OPA_ENABLED: flag,
    OPA_URL: z.string().url().optional(),
    OPA_POLICY_PATH: z.string().default("dashr/authz/allow"),
  })
  .superRefine((c, ctx) => {
    if (c.TEMPORAL_ENABLED && !c.TEMPORAL_ADDRESS) {
      ctx.addIssue({ code: "custom", path: ["TEMPORAL_ADDRESS"], message: "required when TEMPORAL_ENABLED=true (chart: temporal.address)" });
    }
    if (c.TEMPORAL_ADDRESS && !/^[^:]+:\d+$/.test(c.TEMPORAL_ADDRESS)) {
      ctx.addIssue({ code: "custom", path: ["TEMPORAL_ADDRESS"], message: "must be host:port" });
    }
    if (c.OPA_ENABLED && !c.OPA_URL) {
      ctx.addIssue({ code: "custom", path: ["OPA_URL"], message: "required when OPA_ENABLED=true (chart: opa.url)" });
    }
  });

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

/** Parsed, validated configuration. Throws a readable error listing every problem. */
export function getConfig(): AppConfig {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const problems = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
      throw new Error(`dashr-nova configuration is invalid:\n${problems}`);
    }
    cached = result.data;
  }
  return cached;
}
