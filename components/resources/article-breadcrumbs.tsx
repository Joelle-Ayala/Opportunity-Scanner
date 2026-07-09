export function ArticleBreadcrumbs({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-7 text-sm text-slate-600">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <a href="/" className="rounded-sm hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
            Home
          </a>
        </li>
        <li aria-hidden="true" className="text-slate-400">/</li>
        <li>
          <a href="/resources" className="rounded-sm hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
            Resources
          </a>
        </li>
        <li aria-hidden="true" className="text-slate-400">/</li>
        <li className="min-w-0 font-medium text-ink" aria-current="page">
          <span className="line-clamp-1">{title}</span>
        </li>
      </ol>
    </nav>
  );
}
