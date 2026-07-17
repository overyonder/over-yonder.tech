# Infrastructure ownership

Infrastructure is split by ownership rather than by vendor:

- `cloudflare/` owns shared zones, static DNS, DNSSEC, Email Routing, Pages,
  Cloudflare service tokens, and the GitHub Actions secrets used for Pages
  deployment.
- `../../archivist-site/infrastructure/` owns Archivist's SES, SNS, IAM,
  budget, Turnstile, SES-specific DNS, Supabase project settings, Edge
  Functions, and runtime secrets.
- `../../kaistarkk/nixos-config/` owns SOPS-encrypted credentials and the
  homelab services that create runtime DNS state such as ACME challenges and
  dynamic address updates.

Every API-managed production resource should have one and only one owner in
these roots. Human account enrolment, MFA, billing instruments, registrar
transfers and third-party production-access approval are bootstrap operations,
not continuously managed application resources.

The shared Cloudflare root has been imported and applied. The Supabase
Management API token is stored in SOPS. The Archivist root is declared but
still requires an AWS provisioning access-key pair before its existing AWS
resources can be imported and reconciled.

## Outstanding credentials

- Create the least-privilege AWS provisioning access-key pair and store both
  values in SOPS before running OpenTofu against AWS.
- After OpenTofu creates the Archivist SES runtime identity, store its access
  key ID and secret access key in SOPS as well as deploying them to Supabase.
  These are the credentials the Edge Functions use to send early-access mail;
  they are separate from the AWS provisioning credentials.
