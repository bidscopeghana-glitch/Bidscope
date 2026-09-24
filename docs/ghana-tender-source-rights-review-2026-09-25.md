# Ghana tender source review — 25 September 2026

## Ghana-law basis for BidScope's Ghana sources

BidScope is a Ghanaian company, and its [customer Terms](../app/terms/page.tsx)
already choose the laws of the Republic of Ghana. Ghana law is therefore the
starting point for this Ghana-source assessment. This is an operational rights
policy, not a legal opinion or a claim that foreign source terms never apply.

- [Copyright Act, 2005 (Act 690), sections 1–5](https://repository.parliament.gh/server/api/core/bitstreams/4b7ed217-30e6-49bd-80ad-21e081c357cc/content)
  protects original expression, excludes ideas, concepts and methods, recognises
  copyright in certain government-created work, and reserves reproduction and
  public communication of protected work to the rights holder. The practical
  inference is that BidScope may independently state bare procurement facts
  (for example, issuer, title, reference and deadline) and link to the official
  notice, but should not assume the wording, arrangement, PDFs, photos or full
  tender documents are free to copy. Whether a particular title or extract is
  sufficiently original or substantial needs case-specific review.
- [Act 690, section 19](https://repository.parliament.gh/server/api/core/bitstreams/4b7ed217-30e6-49bd-80ad-21e081c357cc/content)
  provides limited permitted uses, including attributed quotations subject to
  conditions. It is **not** a blanket licence to reproduce complete notices or
  attachments in a paid product. BidScope's default link-only listing uses an
  independently worded pointer instead of relying on that exception.
- [Public Procurement Act, 2003 (Act 663), as amended by Act 914](https://ppa.gov.gh/online-documents/public-procurement-act/)
  and [PPA's section-47 guidance](https://ppa.gov.gh/wp-content/uploads/2025/05/COMBINED-2023-NATIONAL-REPORT.pdf)
  require publication of relevant public tender invitations. This supports
  discovery of publicly advertised opportunities; it does **not** itself
  transfer copyright or grant a third-party syndication licence.
- Where a notice includes identifiable individuals' contact information,
  [Data Protection Act, 2012 (Act 843)](https://cybersecurity.gov.gh/documents/Data_Protection_Act_2012.pdf)
  also matters. The link-only record therefore omits personal contacts and
  sends users to the issuer for current details.

For Ghana sources, review the specific portal's terms and access rules as well
as Ghana law before enabling automated fetching. A public notice can be a
candidate for a manually reviewed factual link-only listing without a licence
to mirror its prose or documents. The `permission_unknown` classification stays
in force until that review is recorded; no Ministry of Finance crawl or source
activation follows merely from this legal analysis. For UK, EU, UN and other
foreign sources, their published licences, contractual terms and applicable
foreign law remain relevant even though BidScope operates from Ghana.

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
| MRH e-Bids | [Official portal](https://bids.mrh.gov.gh/) permits viewing adverts and buying bidding documents. It does not state a commercial republication licence for BidScope. | Public visibility is not permission to mirror notices or paid documents; seek a written feed agreement. |
| UK Contracts Finder and Find a Tender | [CCS terms](https://www.contractsfinder.service.gov.uk/Home/TermsAndConditions) place most content under the Open Government Licence, allow feeds for other websites, and identify exemptions. [Find a Tender API documentation](https://www.find-tender.service.gov.uk/Developer/Documentation) confirms OCDS notice data is OGL. CCS also requires permission if a website charges users **to click a link** to these services. | An official API/OGL path is plausible for eligible notice data, with attribution and exception filtering; avoid a paywall on the outbound official link. UK tenders are not Ghana tenders and Ghanaian-bidder eligibility must be checked per notice. |
| TED EU | [Official Search API guidance](https://docs.ted.europa.eu/api/latest/search.html) expressly supports commercial platforms' reuse of published notices. | Candidate official API, subject to API limits, attribution and document-level rights review. EU location does not imply Ghanaian firms qualify. |
| SAM.gov | [Official terms](https://sam.gov/about/terms-of-use) permit public API sharing but prohibit automated scraping and restrict sensitive and third-party data. | Use only the public opportunities API after endpoint-specific terms review; do not treat all SAM data or attachments as commercially reusable. |

These findings distinguish *access* from *commercial reuse*. No general commercial
syndication right was found on the reviewed Ministry of Finance, Bank of Ghana,
MRH or Ghana Highway Authority pages. That is an unresolved permission question,
not a claim that every factual title or link is copyright-protected. Existing
records from sources with unverified rights need provenance review before being
counted as cleared inventory. No blanket pause of other sources' database flags
was applied without approval; the server's fail-closed ingestion checks and the
admin action controls prevent legacy fetch/ingest when rights are not approved.

BidScope sells discovery and analysis, not the issuing authority's tender or
bidding documents. The platform ultimately links the bidder to the official
site. A separately reviewed `public_link_only` discovery path can therefore
publish a short factual pointer and official URL without copying notice prose,
requirements, attachments or contact details. This path still requires a
source-level review of terms and robots instructions, and manual publication
review. The existence of this technical path does **not** automatically clear
the Ghana sources above, nor does it permit charging for a link where a source's
terms specifically forbid that (as with the UK CCS services).

## Acquisition path to 500+

Request a current GHANEPS/PPA OCDS feed or written commercial syndication
permission; then approach major Ghana issuers and development banks for
licensed notice feeds. Count only verified, unexpired, distinct opportunities
with evidence of Ghana relevance and permitted publication. Keep forecast,
closed, award and historical records out of the current-open count. Do not fill
the target by copying competitors or expanding to old/unsupported notices.
