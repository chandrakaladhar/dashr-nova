import { contextFromRequest } from "@/lib/context";
import { errorResponse, Unauthenticated } from "@/lib/errors";
import { createProject } from "@/lib/projects";

// Thin adapter: build the context, call the domain function, translate the
// result. The pipeline itself (validation, OPA, transaction, workflow start)
// is in lib/projects.ts, shared with any page or server action.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = contextFromRequest(request);
    if (!ctx) throw new Unauthenticated();
    const body = await request.json().catch(() => undefined);
    const project = await createProject(ctx, body);
    // 202: the project exists; provisioning continues in the background.
    return Response.json(project, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
