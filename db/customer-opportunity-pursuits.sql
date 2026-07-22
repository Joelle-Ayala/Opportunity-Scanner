-- Customer-owned opportunity pursuit workspace.
-- Apply after customer-dashboard.sql and customer-owned-report-access.sql.

create unique index if not exists scan_opportunities_scan_opportunity_unique_idx
  on scan_opportunities(scan_id, opportunity_id);

create table if not exists customer_opportunity_pursuits (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  scan_id uuid not null,
  opportunity_id uuid not null,
  company_context_key text not null check (char_length(btrim(company_context_key)) between 1 and 500),
  canonical_opportunity_key text not null check (char_length(btrim(canonical_opportunity_key)) between 1 and 2500),
  opportunity_title text not null check (char_length(btrim(opportunity_title)) between 1 and 500),
  company_name text not null check (char_length(btrim(company_name)) between 1 and 240),
  source_name text not null check (char_length(btrim(source_name)) between 1 and 240),
  source_url text not null check (
    char_length(btrim(source_url)) between 8 and 2048
    and source_url ~ '^https?://'
  ),
  target_organization text not null default '' check (char_length(target_organization) <= 500),
  revenue_motion text not null default '' check (char_length(revenue_motion) <= 120),
  application_method text not null check (
    application_method in (
      'direct_application',
      'procurement_response',
      'vendor_registration',
      'buyer_outreach',
      'partner_outreach',
      'monitor'
    )
  ),
  stage text not null default 'qualifying' check (
    stage in ('researching', 'qualifying', 'preparing', 'submitted', 'won', 'lost', 'monitoring')
  ),
  owner_name text not null default '' check (char_length(owner_name) <= 160),
  source_verified boolean not null default false,
  fit_decision text not null default 'not_reviewed' check (
    fit_decision in ('not_reviewed', 'pursue', 'monitor', 'not_fit')
  ),
  route_verified boolean not null default false,
  deadline date,
  next_step text not null default '' check (char_length(next_step) <= 2000),
  eligibility_notes text not null default '' check (char_length(eligibility_notes) <= 6000),
  registration_requirements text not null default '' check (char_length(registration_requirements) <= 6000),
  required_documents text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 12000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_account_id, company_context_key, canonical_opportunity_key),
  foreign key (scan_id, opportunity_id)
    references scan_opportunities(scan_id, opportunity_id)
    on update restrict
    on delete restrict
);

create index if not exists customer_opportunity_pursuits_account_updated_idx
  on customer_opportunity_pursuits(customer_account_id, updated_at desc);
create index if not exists customer_opportunity_pursuits_account_stage_idx
  on customer_opportunity_pursuits(customer_account_id, stage, updated_at desc);
create index if not exists customer_opportunity_pursuits_deadline_idx
  on customer_opportunity_pursuits(deadline)
  where deadline is not null and stage not in ('won', 'lost');

alter table customer_opportunity_pursuits enable row level security;

-- Pursuit reads and writes go through authenticated server routes. Browser roles stay closed.
revoke all on customer_opportunity_pursuits from anon, authenticated;
grant all on customer_opportunity_pursuits to service_role;
