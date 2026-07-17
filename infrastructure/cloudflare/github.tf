locals {
  overyonder_pages_repositories = toset([
    "archivist-site",
    "openzt2-site",
    "over-yonder.tech",
    "pong-site",
  ])
}

resource "github_actions_secret" "cloudflare_token_overyonder" {
  provider = github.overyonder
  for_each = local.overyonder_pages_repositories

  repository  = each.key
  secret_name = "CLOUDFLARE_API_TOKEN"
  value       = cloudflare_account_token.pages_deploy.value
}

resource "github_actions_secret" "cloudflare_account_overyonder" {
  provider = github.overyonder
  for_each = local.overyonder_pages_repositories

  repository  = each.key
  secret_name = "CLOUDFLARE_ACCOUNT_ID"
  value       = local.cloudflare_account_id
}

resource "github_actions_secret" "cloudflare_token_rakelang" {
  provider = github.rakelang

  repository  = "rake-lang.org"
  secret_name = "CLOUDFLARE_API_TOKEN"
  value       = cloudflare_account_token.pages_deploy.value
}

resource "github_actions_secret" "cloudflare_account_rakelang" {
  provider = github.rakelang

  repository  = "rake-lang.org"
  secret_name = "CLOUDFLARE_ACCOUNT_ID"
  value       = local.cloudflare_account_id
}
