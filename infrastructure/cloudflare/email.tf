resource "cloudflare_email_routing_address" "gmail" {
  account_id = local.cloudflare_account_id
  email      = "overyonderstudios@gmail.com"
}

locals {
  email_catchalls = {
    "hannigancooper.com" = {
      live_id = "4091285f713d4b2b8260c25cee99f960"
      name    = "Catch-all to Gmail"
      enabled = true
      action  = "forward"
      values  = ["overyonderstudios@gmail.com"]
    }
    "kai.systems" = {
      live_id = "7038a6ad2059483c873d734e16f036e0"
      name    = "Catch-all to Gmail"
      enabled = true
      action  = "forward"
      values  = ["overyonderstudios@gmail.com"]
    }
    "over-yonder.tech" = {
      live_id = "78c620995b2c492c9058b826b5eeb077"
      name    = ""
      enabled = false
      action  = "drop"
      values  = null
    }
    "polymyth.dev" = {
      live_id = "98633d8da3874005a34b63b06ad59df0"
      name    = "Catch-all to Gmail"
      enabled = true
      action  = "forward"
      values  = ["overyonderstudios@gmail.com"]
    }
    "rake-lang.org" = {
      live_id = "ef90d8f44d864904ad9ea6f1ec551c8c"
      name    = "Catch-all to Gmail"
      enabled = true
      action  = "forward"
      values  = ["overyonderstudios@gmail.com"]
    }
    "re-fill.co" = {
      live_id = "7ddfc5434a7b4ffbbfebdc3576cf4c4a"
      name    = "Catch-all to Gmail"
      enabled = true
      action  = "forward"
      values  = ["overyonderstudios@gmail.com"]
    }
    "thought-led.com" = {
      live_id = "eab6e57dd5e34f74bb4890ab800f337f"
      name    = "Catch-all to Gmail"
      enabled = true
      action  = "forward"
      values  = ["overyonderstudios@gmail.com"]
    }
  }
}

resource "cloudflare_email_routing_catch_all" "zones" {
  for_each = local.email_catchalls

  zone_id = cloudflare_zone.zones[each.key].id
  name    = each.value.name
  enabled = each.value.enabled
  matchers = [{
    type = "all"
  }]
  actions = [{
    type  = each.value.action
    value = each.value.values
  }]
}
