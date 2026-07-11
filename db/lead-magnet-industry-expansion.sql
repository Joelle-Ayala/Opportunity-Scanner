alter table lead_magnet_captures
  drop constraint if exists lead_magnet_captures_lead_magnet_slug_check;

alter table lead_magnet_captures
  add constraint lead_magnet_captures_lead_magnet_slug_check
  check (
    lead_magnet_slug in (
      'public-sector-revenue-opportunity-playbook-2026',
      'healthcare-dme-public-sector-opportunity-report-2026',
      'education-workforce-public-sector-opportunity-report-2026',
      'creative-economy-live-events-public-sector-opportunity-report-2026',
      'software-ai-public-sector-opportunity-report-2026',
      'infrastructure-construction-public-sector-opportunity-report-2026',
      'clean-energy-facilities-public-sector-opportunity-report-2026',
      'manufacturing-supply-chain-public-sector-opportunity-report-2026',
      'nonprofit-community-services-public-sector-opportunity-report-2026'
    )
  );
