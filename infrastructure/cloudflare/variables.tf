variable "state_passphrase" {
  description = "Passphrase used only to encrypt OpenTofu state and plans."
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Least-privilege account token used for normal Cloudflare operations."
  type        = string
  sensitive   = true
}

variable "cloudflare_bootstrap_token" {
  description = "Root-of-trust token used only to manage account-owned API tokens."
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub token used to manage Actions deployment secrets."
  type        = string
  sensitive   = true
}

locals {
  cloudflare_account_id = "72b0273abc2a8ea96004ee8846c4d0a2"
}
