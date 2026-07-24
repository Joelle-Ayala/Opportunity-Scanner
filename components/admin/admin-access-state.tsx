export function AdminAccessState({
  unavailable = false
}: {
  unavailable?: boolean;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase text-accent">Operator workspace</p>
      <h1 className="mt-3 text-2xl font-semibold text-ink">
        {unavailable ? "Admin access is temporarily unavailable" : "Admin access required"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {unavailable
          ? "The secure operator session could not be verified. Try signing in again before making operational decisions."
          : "This workspace is only available to approved Opportunity Scanner operators."}
      </p>
      <a
        href="/auth/sign-in?next=%2Fadmin"
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A6871]"
      >
        Sign in with an approved account
      </a>
    </section>
  );
}
