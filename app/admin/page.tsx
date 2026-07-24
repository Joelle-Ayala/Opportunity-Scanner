import { AdminAccessState } from "@/components/admin/admin-access-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { OperationsOverview } from "@/components/admin/operations-ui";
import { loadAdminOperationsSnapshot } from "@/lib/admin/operations";
import { requireAdminPage } from "@/lib/admin/page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminOperationsPage({
  searchParams
}: {
  searchParams?: { access?: string };
}) {
  const access = await requireAdminPage("/admin", searchParams?.access);
  if (access.status !== "authorized") {
    return <AdminAccessState unavailable={access.status === "unavailable"} />;
  }

  const snapshot = await loadAdminOperationsSnapshot();
  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Launch and customer operations"
        description="A read-only view of the launch gates and recovery systems that protect paid customer access."
        aside={
          <div className="rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-600">
            {snapshot.release.environment} / checked{" "}
            {new Intl.DateTimeFormat("en", {
              hour: "numeric",
              minute: "2-digit"
            }).format(new Date(snapshot.checkedAt))}
          </div>
        }
      />
      <OperationsOverview snapshot={snapshot} />
    </>
  );
}
