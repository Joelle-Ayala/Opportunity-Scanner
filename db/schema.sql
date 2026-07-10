create extension if not exists "pgcrypto";

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  company_url text not null,
  company_name text,
  headquarters_state text,
  target_states text,
  industry text,
  customer_type text,
  email text,
  status text not null default 'queued',
  report_type text not null default 'quick',
  report_access text not null default 'free',
  opportunity_focus text,
  include_terms text,
  exclude_terms text,
  priority_signals jsonb not null default '[]'::jsonb,
  selected_playbooks jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists company_profiles (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  profile_json jsonb not null,
  raw_text text not null default '',
  scraped_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists source_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  source_name text not null,
  source_type text not null,
  query_used text,
  title text,
  url text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text,
  title text not null,
  url text,
  agency text,
  category text,
  deadline text,
  geography text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists scan_opportunities (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  relevance_score int not null default 0,
  novelty_score int not null default 0,
  confidence_score int not null default 0,
  reasoning_json jsonb not null default '[]'::jsonb,
  recommended_action text,
  human_review_required boolean not null default true,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  report_markdown text,
  report_html text,
  report_pdf_url text,
  created_at timestamptz not null default now()
);

create table if not exists report_feedback (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  feedback_kind text not null check (feedback_kind in ('more_like_this', 'less_like_this')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists profile_feedback (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  company_profile_id uuid references company_profiles(id) on delete cascade,
  company_url text,
  opportunity_id uuid references opportunities(id) on delete set null,
  feedback_kind text not null check (
    feedback_kind in (
      'confirm_profile',
      'refine_profile',
      'add_focus',
      'exclude_lane',
      'include_term',
      'exclude_term',
      'more_like_this',
      'less_like_this',
      'change_target_geography',
      'change_priority_signal'
    )
  ),
  value text,
  reason text,
  feedback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists opportunity_enrichment_requests (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  enrichment_type text not null,
  status text not null default 'requested',
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lead_magnet_captures (
  id uuid primary key default gen_random_uuid(),
  lead_magnet_slug text not null check (
    lead_magnet_slug in (
      'public-sector-revenue-opportunity-playbook-2026',
      'healthcare-dme-public-sector-opportunity-report-2026'
    )
  ),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  company text check (company is null or char_length(company) <= 160),
  website text check (website is null or char_length(website) <= 500),
  source text check (source is null or char_length(source) <= 100),
  utm_source text check (utm_source is null or char_length(utm_source) <= 160),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 160),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 160),
  utm_content text check (utm_content is null or char_length(utm_content) <= 160),
  utm_term text check (utm_term is null or char_length(utm_term) <= 160),
  marketing_consent boolean not null default false,
  consented_at timestamptz,
  check (
    (marketing_consent = true and consented_at is not null)
    or (marketing_consent = false and consented_at is null)
  ),
  created_at timestamptz not null default now()
);

alter table lead_magnet_captures enable row level security;

create index if not exists scans_status_idx on scans(status);
create index if not exists company_profiles_scan_id_idx on company_profiles(scan_id);
create index if not exists source_results_scan_id_idx on source_results(scan_id);
create index if not exists scan_opportunities_scan_id_idx on scan_opportunities(scan_id);
create index if not exists report_feedback_scan_id_idx on report_feedback(scan_id);
create index if not exists report_feedback_opportunity_id_idx on report_feedback(opportunity_id);
create index if not exists profile_feedback_scan_id_idx on profile_feedback(scan_id);
create index if not exists profile_feedback_company_url_idx on profile_feedback(company_url);
create index if not exists profile_feedback_company_profile_id_idx on profile_feedback(company_profile_id);
create index if not exists opportunity_enrichment_requests_scan_id_idx on opportunity_enrichment_requests(scan_id);
create index if not exists opportunity_enrichment_requests_opportunity_id_idx on opportunity_enrichment_requests(opportunity_id);
create index if not exists lead_magnet_captures_slug_created_at_idx on lead_magnet_captures(lead_magnet_slug, created_at desc);
