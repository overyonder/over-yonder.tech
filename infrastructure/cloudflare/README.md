# Shared Cloudflare infrastructure

This OpenTofu root owns the shared public infrastructure for every over|yonder
zone: zones, static DNS, DNSSEC, Cloudflare Email Routing, Pages projects and
custom domains, the operational API token policy, and the GitHub Actions
secrets used to deploy Pages.

Archivist-specific SES DNS and Turnstile remain in
`../../archivist-site/infrastructure`; they are application resources rather
than shared account resources. Caddy DNS-01 challenge records are ephemeral
runtime state. The `dyn.kai.systems` record is declared here, but its content is
mutated by the DDNS service declared in the NixOS configuration.

## Credentials

Supply these variables from SOPS-decrypted values; never use a checked-in
`.tfvars` file:

- `TF_VAR_state_passphrase` from `archivist_iac_state_passphrase`;
- `TF_VAR_cloudflare_api_token` from `cloudflare_iac_token`;
- `TF_VAR_cloudflare_bootstrap_token` from `cloudflare_admin_token`;
- `TF_VAR_github_token` from `github_token`.

The bootstrap token is the root of trust and is restricted to account-token
management. OpenTofu adopts the normal infrastructure token and creates a
separate Pages-only deployment token. The latter is written directly to GitHub
Actions secrets and retained only in encrypted OpenTofu state.

## Adoption

Run `tofu init`, then inspect `tofu plan`. The committed import blocks adopt
existing resources. Do not apply any plan containing an unexpected deletion or
replacement. DNSSEC is intentionally desired as active and will therefore show
as a change for zones where it is currently disabled.

Cloudflare Registrar registrations, renewals, contacts, payment methods and the
publication of DS records at an external registrar are control-plane bootstrap
operations not supported as mutable resources by the Cloudflare provider.
Their surrounding zones and DNS are still fully declared here.
