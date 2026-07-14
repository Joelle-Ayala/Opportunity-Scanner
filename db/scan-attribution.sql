alter table scans add column if not exists utm_source text;
alter table scans add column if not exists utm_medium text;
alter table scans add column if not exists utm_campaign text;
alter table scans add column if not exists utm_content text;
alter table scans add column if not exists utm_term text;

alter table scans drop constraint if exists scans_utm_source_length;
alter table scans add constraint scans_utm_source_length
  check (utm_source is null or char_length(utm_source) <= 160);
alter table scans drop constraint if exists scans_utm_medium_length;
alter table scans add constraint scans_utm_medium_length
  check (utm_medium is null or char_length(utm_medium) <= 160);
alter table scans drop constraint if exists scans_utm_campaign_length;
alter table scans add constraint scans_utm_campaign_length
  check (utm_campaign is null or char_length(utm_campaign) <= 160);
alter table scans drop constraint if exists scans_utm_content_length;
alter table scans add constraint scans_utm_content_length
  check (utm_content is null or char_length(utm_content) <= 160);
alter table scans drop constraint if exists scans_utm_term_length;
alter table scans add constraint scans_utm_term_length
  check (utm_term is null or char_length(utm_term) <= 160);

create index if not exists scans_utm_campaign_created_at_idx
  on scans(utm_campaign, created_at desc)
  where utm_campaign is not null;
