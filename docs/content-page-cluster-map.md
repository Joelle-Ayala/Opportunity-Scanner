# Industry and Solution Content Map

Last verified: 2026-07-10

This map separates links that can ship now from deeper articles that remain in the editorial queue. Industry and solution pages must never link to an unpublished slug.

## Industry pages

| Page | Three published resources shown now | Deeper queued cluster |
|---|---|---|
| Healthcare / DME / Medical Supply | `healthcare-public-sector-opportunities`; `grants-contracts-funded-buyers`; `government-buyer-contact-paths` | `dme-medical-supply-government-buyers-channel-partners`; `cms-data-healthcare-market-signals` |
| Education / Workforce / Training | `education-workforce-opportunity-signals`; `grants-contracts-funded-buyers`; `find-funded-buyers-before-cold-outreach` | `training-companies-workforce-funding-signals`; `college-scorecard-training-education-opportunities` |
| Arts / Creative Economy / Live Events | `creative-economy-funding-opportunities`; `grants-contracts-funded-buyers`; `find-funded-buyers-before-cold-outreach` | `city-events-tourism-parks-procurement`; `funded-arts-recipients-partner-targets` |
| Software / B2B Services / AI | `software-ai-public-sector-demand`; `sam-gov-is-not-enough`; `public-sector-sales-pipeline-without-govcon-team` | `translate-software-into-public-sector-use-cases`; `software-prime-contractor-funded-partner-opportunities` |
| Construction / Infrastructure / Engineering | `infrastructure-opportunities-for-construction-companies`; `sam-gov-is-not-enough`; `find-funded-buyers-before-cold-outreach` | `capital-plans-infrastructure-grants-upcoming-projects`; `construction-subcontractor-supplier-funded-primes` |
| Clean Energy / Facilities / Sustainability | `clean-energy-public-sector-opportunities`; `grants-contracts-funded-buyers`; `find-funded-buyers-before-cold-outreach` | `funded-facilities-upgrade-buyers`; `energy-policy-rebates-implementation-demand` |
| Manufacturing / Supply Chain / Logistics | `manufacturing-supply-chain-public-sector-demand`; `government-spending-growth-channel`; `find-funded-buyers-before-cold-outreach` | `manufacturing-usaspending-sam-buyer-map`; `workforce-economic-development-funded-manufacturers` |
| Nonprofits / Community Services / Human Services | `nonprofit-community-services-funding-opportunities`; `grants-contracts-funded-buyers`; `government-buyer-contact-paths` | `find-funded-nonprofits-buyers-partners`; `human-services-direct-apply-sell-partner` |

## Solution pages

| Page | Three published resources shown now | Deeper queued cluster |
|---|---|---|
| Funded Buyer Intelligence | `find-funded-buyers-before-cold-outreach`; `grants-contracts-funded-buyers`; `government-buyer-contact-paths` | `use-usaspending-gov-market-evidence`; `public-sector-signals-sales-trigger-events` |
| Public-Sector Sales Workflow | `public-sector-sales-pipeline-without-govcon-team`; `what-a-public-sector-opportunity-report-should-include`; `public-sector-deal-flow-for-commercial-companies` | `public-sector-opportunity-signals-crm`; `webhooks-opportunity-research-sales-workflow` |
| Contact Paths and Enrichment | `government-buyer-contact-paths`; `find-funded-buyers-before-cold-outreach`; `what-a-public-sector-opportunity-report-should-include` | `source-native-contacts-before-enrichment`; `paid-contact-enrichment-public-sector-sales` |

## Publishing rule

1. Publish and verify a queued article before replacing a current related-resource slug.
2. Keep exactly three links on each page so the section remains useful and secondary to the scan CTA.
3. Prefer one industry-specific article, one money-flow or opportunity article, and one action/contact article.
4. Run `npm run validate:related-content` after every mapping change.
5. Recheck mobile layout and source accuracy whenever a linked article is refreshed.
