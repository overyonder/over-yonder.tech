locals {
  pages_projects = {
    "archivist"        = { production_branch = "main" }
    "openzt2"          = { production_branch = "main" }
    "over-yonder-tech" = { production_branch = "main" }
    "pong-ai"          = { production_branch = "main" }
    "rake-lang"        = { production_branch = "main" }
  }

  pages_domains = {
    "archivist.over-yonder.tech" = { project = "archivist" }
    "openzt2.over-yonder.tech"   = { project = "openzt2" }
    "over-yonder.tech"           = { project = "over-yonder-tech" }
    "pong.over-yonder.tech"      = { project = "pong-ai" }
    "rake-lang.org"              = { project = "rake-lang" }
  }
}

resource "cloudflare_pages_project" "projects" {
  for_each = local.pages_projects

  account_id        = local.cloudflare_account_id
  name              = each.key
  production_branch = each.value.production_branch
}

resource "cloudflare_pages_domain" "domains" {
  for_each = local.pages_domains

  account_id   = local.cloudflare_account_id
  project_name = cloudflare_pages_project.projects[each.value.project].name
  name         = each.key
}
