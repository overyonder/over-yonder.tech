# Architecture

## Archivist early-access email

**Decision:** Write Archivist early-access messages as source-controlled HTML and
use Amazon SES for delivery. Accepted 2026-07-16; scope clarified 2026-07-16.

### Context

Archivist is collecting addresses from people who want to try the product before
its general release. This system belongs to Archivist; no company-wide
over|yonder newsletter is currently planned. We prefer to write and review its
email as source-controlled HTML rather than compose it in an email CMS. We don't
need a hosted publication, visual editor, creator network, permanent application
server, or a service priced by contact count.

The system does need reliable delivery, double opt-in, auditable consent,
standards-compliant removal handling, bounce and complaint suppression, and
resumable message dispatch.

### Direction

Use a small serverless control plane with Amazon Simple Email Service (SES) as
the delivery and deliverability layer:

- The repository contains the canonical web article, email-safe HTML, and a
  plain-text alternative for each message.
- Archivist's early-access form and branded confirmation and removal pages are
  served from `archivist.over-yonder.tech`.
- Supabase Postgres stores pending confirmations, consent history, recipient
  state, immutable message records, and per-recipient delivery state.
- Supabase Edge Functions implement joining, confirmation, removal, and SES
  event endpoints.
- A queue-backed, idempotent sender dispatches bounded batches through SES. No
  continuously running application process is required.
- SES provides outbound delivery, DKIM signing, delivery events, and bounce and
  complaint suppression.
- SES contact-list preferences are kept synchronized with the local recipient
  record. Neither source may be bypassed when selecting recipients.
- Messages are sent separately to each recipient so they can contain
  recipient-specific links and standards-compliant unsubscribe headers.
- The send operation is initiated from a repository command, not a web UI.

### Joining early access

1. Normalize and validate the submitted address.
2. Store a pending request with a hashed, random, expiring, single-use
   confirmation token.
3. Send our own HTML and plain-text confirmation message through SES.
4. On confirmation, atomically consume the token, record the consent event, and
   set the recipient and SES topic preference to `OPT_IN`.

The consent record includes the address, request and confirmation timestamps,
the source and version of the signup form, and the applicable policy version.
Pending requests don't receive early-access messages.

### Leaving early access

- Every early-access message contains a branded removal link plus the
  `List-Unsubscribe` and `List-Unsubscribe-Post` headers required for mailbox
  one-click unsubscribe.
- The one-click endpoint accepts the RFC 8058 POST operation without requiring
  authentication or further interaction.
- A browser GET displays our own confirmation or preference page and does not
  mutate early-access state. This prevents link scanners from removing
  recipients merely by following a URL.
- Removal credentials are opaque or cryptographically signed, scoped to the
  recipient and purpose, and reveal no address in clear text.
- Leaving early access updates both the local record and SES preference.
  Suppression and removal checks are repeated at dispatch time, including on
  retries.

### Message source and dispatch

An early-access update will conventionally contain:

```text
early-access-email/
  YYYY-MM-slug/
    index.html
    email.html
    email.txt
```

A command such as `early-access-email send YYYY-MM-slug` validates the source,
records an immutable message, and queues recipient deliveries. Delivery rows
and SES message identifiers make retries idempotent and auditable.

### Infrastructure requirements

- An SES account with production access in the selected AWS region.
- A verified sending identity and custom MAIL FROM subdomain.
- Correct DKIM, SPF, and DMARC records in Cloudflare DNS.
- SES delivery, bounce, complaint, open, click, and contact-preference events
  delivered to the control plane.
- `links.over-yonder.tech` used as the HTTPS-required SES redirect domain for
  Archivist open and click tracking.
- Secrets held in deployment secret storage, never in the repository.

### Non-goals

- A browser-based editor, CMS, or email-platform-hosted canonical archive.
- A persistent listmonk-style application server.
- A company-wide over|yonder mailing list.
- Marketing automation, lead scoring, referral networks, or advertising.
- Using Fastmail to send bulk mail. Fastmail remains the human mailbox service.

### Consequences

We retain complete control over Archivist's content, URLs, consent presentation,
and data, while delegating mail transport and reputation-sensitive suppression
to SES.
The system has no permanent compute cost and no per-contact platform charge.

We are responsible for the correctness of confirmation tokens, consent records,
queue retries, recipient selection, removal synchronization, and event
processing. These paths must be idempotent and must fail closed: uncertainty
about consent or suppression means that a message isn't sent.
