terraform {
  required_version = ">= 1.10.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.21"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  encryption {
    key_provider "pbkdf2" "state" {
      passphrase               = var.state_passphrase
      key_length               = 32
      iterations               = 600000
      salt_length              = 32
      hash_function            = "sha512"
      encrypted_metadata_alias = "over-yonder-cloudflare"
    }

    method "aes_gcm" "state" {
      keys = key_provider.pbkdf2.state
    }

    state {
      method   = method.aes_gcm.state
      enforced = true
    }

    plan {
      method   = method.aes_gcm.state
      enforced = true
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "cloudflare" {
  alias     = "bootstrap"
  api_token = var.cloudflare_bootstrap_token
}

provider "github" {
  alias = "overyonder"
  owner = "overyonder"
  token = var.github_token
}

provider "github" {
  alias = "rakelang"
  owner = "rakelang"
  token = var.github_token
}
