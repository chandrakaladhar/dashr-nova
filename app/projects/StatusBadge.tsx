const tone: Record<string, string> = {
  active: "good",
  failed: "bad",
  expired: "bad",
  skipped: "bad",
  blocked: "warn",
  partially_provisioned: "warn",
  provisioning: "busy",
  pending: "idle",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${tone[status] ?? "idle"}`}>{status.replace("_", " ")}</span>;
}
