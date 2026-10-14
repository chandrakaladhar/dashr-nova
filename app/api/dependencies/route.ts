import { checkDependencies } from "@/lib/dependencies";

// Status of every configured dependency. Used by `helm test` and for diagnosis.
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkDependencies();
  return Response.json(report, { status: report.ok ? 200 : 503 });
}
