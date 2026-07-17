locals {
  account_resource = jsonencode({
    "com.cloudflare.api.account.72b0273abc2a8ea96004ee8846c4d0a2" = "*"
  })
  account_zones_resource = jsonencode({
    "com.cloudflare.api.account.72b0273abc2a8ea96004ee8846c4d0a2" = {
      "com.cloudflare.api.account.zone.*" = "*"
    }
  })
}

# This resource adopts the durable operational token already stored in SOPS.
# Its value is an input to the default provider, so the bootstrap alias manages
# its policy without creating a provider dependency cycle.
resource "cloudflare_account_token" "infrastructure" {
  provider   = cloudflare.bootstrap
  account_id = local.cloudflare_account_id
  name       = "OpenTofu infrastructure"
  status     = "active"

  policies = [
    {
      effect    = "allow"
      resources = local.account_resource
      permission_groups = [
        { id = "755c05aa014b4f9ab263aa80b8167bd8" }, # Turnstile Sites Write
        { id = "8d28297797f24fb8a0c332fe0866ec89" }, # Pages Write
        { id = "9bb90620717647a39679e1d951f140d6" }, # Registrar Domains Read
        { id = "b714141b1e1941cebb38c017036262a6" }, # Email Routing Suppressions Write
        { id = "e4589eb09e63436686cd64252a3aebeb" }, # Email Routing Addresses Write
      ]
    },
    {
      effect    = "allow"
      resources = local.account_zones_resource
      permission_groups = [
        { id = "0a6cfe8cd3ed445e918579e2fb13087b" }, # Zone DNS Settings Read
        { id = "1b600d9d8062443e986a973f097e728a" }, # Email Routing Rules Read
        { id = "3030687196b94b638145a3953da2b699" }, # Zone Settings Write
        { id = "4755a26eedb94da69e1066d98aa820be" }, # DNS Write
        { id = "517b21aee92c4d89936c976ba6e4be55" }, # Zone Settings Read
        { id = "79b3ec0d10ce4148a8f8bdc0cc5f97f2" }, # Email Routing Rules Write
        { id = "82e64a83756745bbbb1c9c2701bf816b" }, # DNS Read
        { id = "c4df38be41c247b3b4b7702e76eadae0" }, # Zone DNS Settings Write
        { id = "c8fed203ed3043cba015a93ad1616f1f" }, # Zone Read
        { id = "e6d2666161e84845a636613608cee8d5" }, # Zone Write
      ]
    },
  ]

  lifecycle {
    prevent_destroy = true
  }
}

# GitHub receives a distinct token that can deploy Pages but cannot edit DNS,
# zones, email routing, Turnstile, or other account resources.
resource "cloudflare_account_token" "pages_deploy" {
  provider   = cloudflare.bootstrap
  account_id = local.cloudflare_account_id
  name       = "GitHub Pages deployments (OpenTofu)"
  status     = "active"

  policies = [{
    effect    = "allow"
    resources = local.account_resource
    permission_groups = [
      { id = "8d28297797f24fb8a0c332fe0866ec89" }, # Pages Write
    ]
  }]
}
