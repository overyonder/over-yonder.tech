locals {
  zones = {
    "hannigancooper.com" = { live_id = "701ef85a414cd35977d75cbef18f014d" }
    "kai.systems"        = { live_id = "0f27784427633e426c21e1e03e781ee6" }
    "over-yonder.tech"   = { live_id = "8fdf6b25e90b44ca9e8639e9bda2ffeb" }
    "polymyth.dev"       = { live_id = "ff4dd8d0d771789f7dc2a706f1adeabd" }
    "rake-lang.org"      = { live_id = "8d7607432b8c7c346ec11cbea8fa5fdb" }
    "re-fill.co"         = { live_id = "6f82f1e8cf06cbb2fffcc44e967b409e" }
    "thought-led.com"    = { live_id = "00dfd82b4afebef3ee6b0acbda639356" }
  }
}

resource "cloudflare_zone" "zones" {
  for_each = local.zones

  account = { id = local.cloudflare_account_id }
  name    = each.key
  type    = "full"
}

# Cloudflare Registrar domains can publish DS records automatically. The two
# retiring Namecheap registrations still receive zone signing; their registrar
# DS publication remains an external registrar bootstrap operation.
resource "cloudflare_zone_dnssec" "zones" {
  for_each = local.zones

  zone_id = cloudflare_zone.zones[each.key].id
  status  = "active"
}
