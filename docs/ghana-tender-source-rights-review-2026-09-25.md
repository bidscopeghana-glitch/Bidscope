# Ghana tender source review — 25 September 2026

## Coverage verified in production

The live `procurement_opportunities` query returned **56** Ghana records with
`status in ('OPEN','CLOSING_SOON')` and a future deadline: GHANEPS 33, UNGM 19,
World Bank 3, and Ghana Highway Authority 1. This is a count of indexed records,
not a legal-rights clearance or a guarantee that each tender is still open on
its issuing portal. No verified source examined supports a claim of 500 current,
distinct Ghana tenders today.

## Rights decisions

| Source | Evidence and scope | Decision |
| --- | --- | --- |
| GHANEPS OCDS registry | [OCDS publication](https://data.open-contracting.org/en/publication/85); previously approved structured-data path | Retain the existing approved importer, separate from page crawling. Latest downloaded dataset ended in June 2026, so it cannot supply current September notices. |
| World Bank | [Procurement Notices](https://datacatalog.worldbank.org/search/dataset/0037795/world-bank-procurement-notices), [Projects & Operations](https://datacatalog.worldbank.org/search/dataset/0037800/world-bank-projects-operations), and [IPF FY2020+ Contract Awards](https://datacatalog.worldbank.org/search/dataset/0066219/contract-awards-in-investment-project-financing-since-fy-2020) each state CC BY 4.0; [terms](https://data.worldbank.org/summary-terms-of-use) allow commercial reuse with attribution | Permit these three dataset integrations with attribution. Do not assume attachments or unrelated datasets share this licence. |
| UNGM | [Official rights guidance](https://help.ungm.org/hc/en-us/articles/360012913619-Intellectual-Property-Rights-and-Copyright) expressly bars commercial/public reuse and republication without written permission | Disable connector and classify as prohibited pending specific written permission. Existing imported rows require separate provenance and publication review; do not silently treat them as cleared. |
| PPA tender portal | [PPA says procuring entities should advertise tenders on its site](https://ppa.gov.gh/advertisers-announcements-2/). Publication on PPA is not a BidScope republication licence. | Candidate for written permission or a licensed feed; no crawler or mirrored documents before approval. |
| Ministry of Finance | [Official adverts](https://www.mofep.gov.gh/adverts) include procurement notices, but no general commercial reuse grant was verified. The latest examined September notice had already closed. | Keep disabled; request rights and technical feed permission. |
| Bank of Ghana | [Official tender notices](https://www.bog.gov.gh/notice/invitation-for-tenders/) exist, but no commercial republication licence was verified. | Keep disabled pending rights; debug its failed endpoint only for read-only diagnostics. |
| Ghana Highway Authority | [Official tender page](https://highways.gov.gh/tenders) is public, not a reuse licence. | Seek permission before further content ingestion. |
| African Development Bank | [Official specific procurement notices](https://www.afdb.org/en/documents/project-related-procurement/procurement-notices/specific-procurement-notices/8) include regional opportunities. This review did not establish Ghana-bidder eligibility or a commercial-reuse licence. | Candidate only; assess notice-level eligibility and rights before integration. |

## Acquisition path to 500+

Request a current GHANEPS/PPA OCDS feed or written commercial syndication
permission; then approach major Ghana issuers and development banks for
licensed notice feeds. Count only verified, unexpired, distinct opportunities
with evidence of Ghana relevance and permitted publication. Keep forecast,
closed, award and historical records out of the current-open count. Do not fill
the target by copying competitors or expanding to old/unsupported notices.
