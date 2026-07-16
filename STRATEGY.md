# Strategy

This document records the decisions that govern how over|yonder presents and
develops the business. It distinguishes durable decisions from experiments so
that results can refine the strategy without silently changing its premises.

## Search discovery and conversion

Search has one commercial job for over|yonder: bring people with difficult
software or engineering problems to credible evidence of our work, then help
the right people decide to contact us. Traffic is useful only as an input to
that outcome.

### Fleet model

over|yonder manages its corporate site, product sites and project sites as one
interconnected web fleet. The sites represent one body of engineering work
under common ownership, even when a product has its own name, audience and
domain. Fleet management gives the reader a coherent route from a technical
problem to its evidence, from that evidence to the relevant product, and from
the product to over|yonder's broader engineering capability.

The fleet is the unit of strategy, governance and reporting. Each hostname and
canonical page remains a separate measurement unit so that an aggregate gain
cannot conceal a weak product site or article.

- `over-yonder.tech` is the corporate authority, portfolio and common point of
  contact.
- Product and project sites explain their own software to their own audiences.
- The corporate site links to each product where it demonstrates over|yonder's
  work or gives a prospective customer a useful next step.
- Each product site identifies its relationship to over|yonder and links back
  to the corporate site through a consistent header, footer or company page.
- Case studies link to the exact product page or technical article that
  supplies the evidence. Product sites link back to relevant case studies when
  the case study helps a buyer understand the implementation or result.
- Links between sibling products appear only when the destination genuinely
  helps the reader. The fleet will not create an all-to-all link mesh, repeated
  keyword-rich footer links or pages whose only purpose is reciprocal linking.
- Link text describes the destination and its relevance. Product names are
  sufficient where the surrounding sentence has already established what the
  product does.
- Every site retains its own canonical URLs, sitemap, structured data, social
  identity and page-level performance data. Common ownership does not collapse
  distinct products into duplicate pages.
- Structured data should identify over|yonder as the publisher, creator, brand
  or parent organisation when that relationship is factually correct. The
  visible page must state the same relationship.
- `hello@over-yonder.tech` is the public contact address across the fleet. A
  single address presents one accountable organisation, preserves cross-sell
  opportunities and avoids fragmenting correspondence by product.

Cross-site links can improve discovery because search engines use ordinary
HTML links to find pages and understand their relevance. Their primary value
is the real relationship they express: a prospective customer can move between
the company, the product and the proof without reconstructing that relationship
from search results. Search authority still depends mainly on useful work and
independent recognition. Links created principally to manipulate rankings are
excluded from the fleet model.

### What tends to matter

Large SEO datasets can reveal useful associations, but they cannot recover
Google's ranking function. Successful pages and sites consistently exhibit the
following characteristics:

- Search engines can crawl, render, index and identify the canonical version
  of every public page.
- A page satisfies a recognizable search intent and uses the language people
  use to describe that problem.
- Titles, headings and descriptions identify the subject directly and set an
  accurate expectation for the result.
- The material contributes original evidence, measurements, analysis or
  experience beyond what competing pages repeat.
- The account is complete enough that the reader does not need another search
  to understand the answer.
- Claims identify their author, method, measurement boundaries and supporting
  evidence where those details affect trust.
- Relevant and reputable independent sites link to or cite the page, project,
  author or company.
- Internal links make the relationship between the company, its projects and
  its technical evidence unambiguous.
- The site has a coherent subject and a reputation earned within that subject,
  rather than a large collection of unrelated search-targeted pages.
- Visitors choose the result when it appears. The title, description and rich
  result must earn the click without exaggerating the page.
- The page is secure, responsive, accessible, fast and stable. Strong page
  experience supports the result; it does not substitute for relevance,
  evidence or authority.
- Content remains accurate and maintained. Dates change only when the material
  changes substantially.
- The backlink profile and visitor behaviour arise from useful work rather
  than manufactured links, keyword repetition or other ranking manipulation.

These are operating priorities, not numerical Google weights. Correlation
studies are most useful for identifying omissions and comparison groups. They
cannot isolate causes when authority, links, age, investment and content
quality move together.

### Decisions

- Write for a technically serious prospective customer first. Search
  optimisation should help that reader discover and understand the work.
- Make technical case studies the principal search assets. Each case study
  should state the original problem, establish the measurement, identify the
  actual constraint, explain the intervention and report comparable results.
- Prefer a small body of original, first-hand material over routine publishing
  or automatically generated keyword pages.
- Maintain one canonical public URL for each page. Every title, description,
  sitemap entry, structured-data record, social card and internal link should
  agree with it.
- Keep conventional HTML links and useful standalone HTML content. The sites
  must remain understandable without client-side application code.
- Make fleet-wide decisions from one inventory, one technical audit and one
  monthly report. Preserve hostname and canonical page as dimensions in every
  dataset and report.
- Use Google Search Console as the authoritative record of Google impressions,
  clicks, click-through rate, average position, indexing and search appearance.
- Use Cloudflare Web Analytics for aggregate page views, referrers, countries,
  devices and real-user performance. We will not add Google Analytics, an
  advertising pixel or a tag manager without a measurement need that the
  privacy-preserving system cannot answer.
- Measure contact intent on every public page. A small first-party endpoint will
  count a click on `mailto:hello@over-yonder.tech` by canonical source page and
  date. It will store no cookie, persistent visitor identifier, IP address,
  message content or email address.
- Describe the contact metric as a mail-link click or contact-intent event. A
  browser opening an email client does not prove that the visitor sent an
  email.
- Use Ahrefs Free as the independent external assessment. Track its Site Audit
  Health Score, Domain Rating, URL Rating, referring domains, backlinks and
  estimated organic keywords. These are Ahrefs measurements, not Google
  ranking signals.
- Do not run A/B tests until the eligible traffic can support a predeclared
  sample size and decision rule. Before then, improve weak pages using direct
  reader feedback, search intent, contact-intent evidence and editorial
  judgment.

### Fleet inventory

Verified 16 July 2026. `tools/seo-sites.json` is the machine-readable source of
truth for this inventory.

| Hostname | Canonical pages | Sitemap | Repository and deployment | Cloudflare |
| --- | ---: | --- | --- | --- |
| `over-yonder.tech` | 2 | `/sitemap.xml` | `overyonder/over-yonder.tech`, `main:/` | Pages `over-yonder-tech`; Web Analytics enabled |
| `archivist.over-yonder.tech` | 4 | `/sitemap.xml` | `overyonder/archivist-site`, `main:/` | Pages `archivist`; Web Analytics enabled |
| `openzt2.over-yonder.tech` | 6 | `/sitemap.xml` | `overyonder/openzt2-site`, `main:/` | Pages `openzt2`; Web Analytics enabled |
| `pong.over-yonder.tech` | 1 | `/sitemap.xml` | `overyonder/pong-site`, `main:/` | Pages `pong-ai`; Web Analytics enabled |
| `rake-lang.org` | 1 | `/sitemap.xml` | `rakelang/rake-lang.org`, `main:/` | Pages `rake-lang`; Web Analytics enabled |

All five sites deploy to Cloudflare Pages through repository-owned GitHub
Actions. Cloudflare now provides the origin, DNS, CDN and fleet analytics.

### Implementation checklist

The fleet already has a shared SEO audit, verified Search Console properties,
submitted sitemaps and baseline metadata. The next work should proceed in this
order:

- [x] Create one current fleet inventory from `tools/seo-sites.json`. Confirm
  every production hostname, canonical page, sitemap, repository and Cloudflare
  project before configuring services against it.
- [x] Enable Cloudflare Web Analytics for every production hostname. Verify a
  real page view from each site and confirm that Cloudflare reports hostname,
  pathname, referrer, country, device and real-user performance as expected.
- [x] Audit the visible fleet links and contact links. Every product site must
  identify over|yonder, link to `over-yonder.tech` and expose
  `hello@over-yonder.tech`; every corporate proof point must link to the exact
  product or technical article it describes.
- [x] Take a dated Search Console baseline for every property. Record indexed
  and excluded pages, sitemap status, crawl or security errors, impressions,
  clicks, click-through rate, average position, leading queries and leading
  pages. Low or absent traffic is a valid baseline.
- [ ] Create and verify every fleet site in Ahrefs Free. Run the first Site
  Audit and record Health Score, Domain Rating, URL Rating, referring domains,
  backlinks, estimated keywords and every actionable crawl issue.
- [ ] Reconcile the three technical views: the repository SEO audit, Search
  Console and Ahrefs. Fix objective defects such as broken links, contradictory
  canonicals, missing pages and failed metadata before making content changes
  based on estimated rankings.
- [ ] Implement the first-party contact-intent endpoint, daily D1 aggregates
  and the shared `mailto:` event script. Test one event from every hostname and
  confirm that the email client still opens normally when measurement fails.
- [ ] Build the private Search Console collector and SQLite schema. Backfill the
  available history, schedule weekly finalised-data imports and generate the
  first fleet, hostname and page-level monthly report.
- [ ] Add monthly Ahrefs observations and Cloudflare page-view and
  contact-intent aggregates to the same report. Record the source and date of
  every metric so that unlike measurements are never silently combined.
- [ ] Begin the review cadence: weekly launch checks, one monthly decision
  report and one quarterly strategy review. Every content change made for
  search performance must record its hypothesis and next assessment date.

### Fleet integration audit — 16 July 2026

The corporate homepage links each proof point to its exact destination: the
Rstat case study, Archivist performance article, OpenZT2 site, Rake site and
Pong AI site. Archivist, OpenZT2 and Rake identify over|yonder and link to the
corporate site. Pong AI does neither, so its shared site footer still needs the
corporate identity and link.

The public corporate pages expose `hello@over-yonder.tech`. None of the
canonical Archivist, OpenZT2, Pong AI or Rake pages expose that address. Add the
shared contact link to every public product page when the fleet footer work is
implemented. Cloudflare may obfuscate the address in delivered HTML, so future
audits must check both the repository source and the rendered link instead of
treating the rewritten URL as a missing address.

### Search Console baseline — 16 July 2026

Search Console has two fleet properties. The `over-yonder.tech` domain property
covers the corporate site and its Archivist, OpenZT2 and Pong AI subdomains.
Rake is covered by the separate `rake-lang.org` domain property.

| Property | Clicks | Impressions | CTR | Average position | Page indexing | Safety |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `over-yonder.tech` | 0 | 0 | 0% | 0 | Google is still processing the report | No manual actions or security issues |
| `rake-lang.org` | 0 | 5 | 0% | 29.4 | Google is still processing the report | No manual actions or security issues |

The performance window currently contains data from 13–14 July 2026. Rake's
only reported page is `https://rake-lang.org/`, with five impressions. Its only
visible query is “what does the rake do”, with one impression. Search Console
doesn't expose the remaining low-volume queries in the table.

All submitted sitemaps report `Success`. Google discovered two corporate
pages, four Archivist pages, six OpenZT2 pages, one Pong AI page and one Rake
page. Indexed and excluded page counts aren't available yet because both Page
indexing reports are still processing. Recheck those counts during the first
weekly launch review.

### Instrumentation

- Enable Cloudflare Web Analytics on every production hostname and confirm that
  each canonical page appears independently in its reports.
- Use one fleet event schema for all sites. Every page-view or contact-intent
  aggregate must retain the production hostname and canonical pathname.
- Give every public article and project page a visible link to
  `hello@over-yonder.tech`. The main homepage and Rstat case study already have
  contact links; the connected project repositories must be audited as part of
  implementation.
- Add one small deferred script to contact links. On activation it sends the
  canonical pathname to a same-origin Cloudflare Worker with
  `navigator.sendBeacon`, then allows the normal `mailto:` action to continue.
- Validate the event path against a fixed set of public canonical paths. Store
  daily aggregate counts in a Cloudflare D1 table rather than retaining raw
  request records.
- Record page views and contact-intent events separately. The useful conversion
  measure is `contact-intent clicks / article views`, accompanied by the raw
  numerator and denominator.
- Retain zero-event periods. An article with 500 views and no contact clicks
  conveys different information from an article whose analytics were absent.
- Exclude known development and administrative traffic where the chosen tools
  support it. Never invent precision that the remaining bot traffic, blockers
  and client-side failures cannot supply.

Cloudflare Web Analytics does not currently support custom events or UTM query
parameters, so its standard beacon cannot measure the contact action by itself.
The first-party counter exists only to answer that specific commercial
question.

### Search Console review and retention

- Run the repository SEO audit on every relevant change and on its scheduled
  GitHub Actions cadence. Treat crawl, canonical, metadata, structured-data,
  broken-link and sitemap regressions as release defects.
- Check Search Console once a week while a site or important article is newly
  launched. Confirm indexing, sitemap processing, manual actions, security
  issues and material crawl failures. Do not rewrite pages in response to
  ordinary daily position movement.
- Conduct the decision-making review monthly. Compare complete calendar months
  and inspect pages, queries, impressions, clicks, click-through rate and
  average position. Separate branded from non-branded searches when the data
  volume makes that classification available.
- Review strategy quarterly. Compare rolling three-month and year-on-year
  periods where available, then decide which subjects deserve expansion, which
  result snippets need improvement and which strong pages need relevant links
  or follow-up material.
- Record algorithm updates, launches, URL changes and substantial article
  revisions as annotations in the offline dataset. Without those dates, later
  changes cannot be interpreted responsibly.
- Export finalised Search Console data weekly through the Search Analytics API.
  Keep separate daily tables for property totals, pages, queries by page,
  countries, devices and search appearances. Combining every dimension in one
  request would fragment the small dataset and cause useful rows to disappear
  behind the API's result limits.
- Store clicks, impressions and average position as the source observations.
  Calculate click-through rate from the aggregated clicks and impressions
  instead of averaging Google's already calculated rates.
- Preserve the API results in a private SQLite database and generate monthly
  CSV summaries for durable, tool-independent review. Upsert by the complete
  dimension key so repeated exports correct preliminary data without
  duplicating it.
- Keep Search Console's UI as the primary interactive view while traffic is
  small. The offline database preserves history beyond the UI's rolling window,
  combines all properties and allows search data to be joined to Cloudflare
  page views and contact-intent aggregates.
- Present the monthly report first as fleet totals, then by hostname and page.
  The fleet view answers whether the portfolio is attracting and converting
  relevant demand. The lower levels identify which product or article caused
  the result.
- Accept that the Search Analytics API returns Google's most significant rows,
  not every rare or anonymised query. If truncation becomes material, replace
  the API collector with Search Console's daily BigQuery bulk export rather
  than treating missing rows as zero.

### Monthly decision report

The monthly report should remain short enough to read and act on. It contains:

- Indexed pages, exclusions and technical errors requiring action.
- Non-branded queries gaining or losing meaningful impressions.
- Pages with high impressions but weak click-through rates.
- Pages approaching the first page of results, where a substantive improvement
  or relevant citation could matter.
- Organic entrances, total views, contact-intent clicks and contact-intent rate
  for each article.
- New referring domains and consequential lost links.
- Current Ahrefs Health Score and authority metrics, with changes since the
  previous month.
- Decisions made, the evidence for each decision and the date on which its
  effect should next be assessed.

The report should prefer absolute counts when samples are small. A conversion
rate based on one click is an observation, not a trend.
