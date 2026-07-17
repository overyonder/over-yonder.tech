# Stable map keys retain the live record ID so changing record content does not
# change its OpenTofu address. Archivist's SES records remain owned by the
# Archivist application stack. ACME challenge records are runtime state created
# by Caddy's DNS-01 automation and therefore are deliberately not static here.
locals {
  shared_dns_records = {
    "hannigancooper.com/1c0789c2c8908118d9bf09d888738683" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "TXT"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "1c0789c2c8908118d9bf09d888738683"
    }
    "hannigancooper.com/2de707d3ad9b0395c500f505b28f9944" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "A"
      content  = "185.199.109.153"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "2de707d3ad9b0395c500f505b28f9944"
    }
    "hannigancooper.com/39320d44eef59cf8f055a9de61fa770d" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "MX"
      content  = "route1.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 64
      comment  = null
      live_id  = "39320d44eef59cf8f055a9de61fa770d"
    }
    "hannigancooper.com/3fd7db34eb5cf62395de55f79764498a" = {
      zone     = "hannigancooper.com"
      name     = "cf2024-1._domainkey.hannigancooper.com"
      type     = "TXT"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "3fd7db34eb5cf62395de55f79764498a"
    }
    "hannigancooper.com/74e958e27ac7525fd0b27b9263f47b8d" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "MX"
      content  = "route3.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 10
      comment  = null
      live_id  = "74e958e27ac7525fd0b27b9263f47b8d"
    }
    "hannigancooper.com/a0a6b943006854d93411554ad8763f41" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "A"
      content  = "185.199.111.153"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "a0a6b943006854d93411554ad8763f41"
    }
    "hannigancooper.com/b1dbbdebffcd2986dc712778fb4dd6d8" = {
      zone     = "hannigancooper.com"
      name     = "www.hannigancooper.com"
      type     = "CNAME"
      content  = "hannigancooper.github.io"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "b1dbbdebffcd2986dc712778fb4dd6d8"
    }
    "hannigancooper.com/bdd0e3fe20870fb298d0e3cb692ea6b3" = {
      zone     = "hannigancooper.com"
      name     = "_github-pages-challenge-hannigancooper.hannigancooper.com"
      type     = "TXT"
      content  = "\"21d6fbdaf078425ee294a49c7a4b19\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "bdd0e3fe20870fb298d0e3cb692ea6b3"
    }
    "hannigancooper.com/c64fbf236c0e70077c30cf353a95ad63" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "A"
      content  = "185.199.110.153"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "c64fbf236c0e70077c30cf353a95ad63"
    }
    "hannigancooper.com/d3c37dbf7671eca79303dba04d46c85f" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "MX"
      content  = "route2.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 60
      comment  = null
      live_id  = "d3c37dbf7671eca79303dba04d46c85f"
    }
    "hannigancooper.com/e0826edd3936029b6a56daca0cc3e987" = {
      zone     = "hannigancooper.com"
      name     = "hannigancooper.com"
      type     = "A"
      content  = "185.199.108.153"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "e0826edd3936029b6a56daca0cc3e987"
    }
    "kai.systems/22ebf5387b5b00640ff9e3cf39958664" = {
      zone     = "kai.systems"
      name     = "kai.systems"
      type     = "TXT"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "22ebf5387b5b00640ff9e3cf39958664"
    }
    "kai.systems/2dfad7323fb63759f9c8781a4e9c81b2" = {
      zone     = "kai.systems"
      name     = "kai.systems"
      type     = "MX"
      content  = "route3.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 94
      comment  = null
      live_id  = "2dfad7323fb63759f9c8781a4e9c81b2"
    }
    "kai.systems/350015aa51ef93d1af976bfaa992ef7b" = {
      zone     = "kai.systems"
      name     = "archivist.kai.systems"
      type     = "CNAME"
      content  = "98cbcc8b-0509-477e-9530-6ac0bc799569.cfargotunnel.com"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "350015aa51ef93d1af976bfaa992ef7b"
    }
    "kai.systems/40561c2577d5dc76949af8652c2585de" = {
      zone     = "kai.systems"
      name     = "_github-pages-challenge-kaistarkk.github.kai.systems"
      type     = "TXT"
      content  = "\"bc93ecac2a53fd1356be6538cec577\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "40561c2577d5dc76949af8652c2585de"
    }
    "kai.systems/4f66ccd36c9ede17d369dd2540bb877f" = {
      zone     = "kai.systems"
      name     = "send.kai.systems"
      type     = "CNAME"
      content  = "98cbcc8b-0509-477e-9530-6ac0bc799569.cfargotunnel.com"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "4f66ccd36c9ede17d369dd2540bb877f"
    }
    "kai.systems/5b21386274815725108f6d079b4ca51e" = {
      zone     = "kai.systems"
      name     = "cf2024-1._domainkey.kai.systems"
      type     = "TXT"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "5b21386274815725108f6d079b4ca51e"
    }
    "kai.systems/71818f69b3a4f9ee3d24aafd527f00d8" = {
      zone     = "kai.systems"
      name     = "librarian.kai.systems"
      type     = "CNAME"
      content  = "98cbcc8b-0509-477e-9530-6ac0bc799569.cfargotunnel.com"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "71818f69b3a4f9ee3d24aafd527f00d8"
    }
    "kai.systems/773f0f84f98162e50d5fea57caa157aa" = {
      zone     = "kai.systems"
      name     = "abs.kai.systems"
      type     = "CNAME"
      content  = "98cbcc8b-0509-477e-9530-6ac0bc799569.cfargotunnel.com"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "773f0f84f98162e50d5fea57caa157aa"
    }
    "kai.systems/868034b59e23795f108db4f97fec7cb2" = {
      zone     = "kai.systems"
      name     = "kai.systems"
      type     = "MX"
      content  = "route2.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 34
      comment  = null
      live_id  = "868034b59e23795f108db4f97fec7cb2"
    }
    "kai.systems/a361667bb6a54c01512c2c1919c98f4a" = {
      zone     = "kai.systems"
      name     = "kai.systems"
      type     = "MX"
      content  = "route1.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 81
      comment  = null
      live_id  = "a361667bb6a54c01512c2c1919c98f4a"
    }
    "kai.systems/c4cbfe7464eec51d5ddaff58ed183b5b" = {
      zone     = "kai.systems"
      name     = "kai.systems"
      type     = "TXT"
      content  = "\"google-site-verification=GBiREOxWdxG3Ka_g3N62koGmxS6RIs1eUHUSNI2Xqlw\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "c4cbfe7464eec51d5ddaff58ed183b5b"
    }
    "over-yonder.tech/07437915e0e95cf8b50a5e31d8042e26" = {
      zone     = "over-yonder.tech"
      name     = "over-yonder.tech"
      type     = "MX"
      content  = "in2-smtp.messagingengine.com"
      ttl      = 1
      proxied  = false
      priority = 20
      comment  = null
      live_id  = "07437915e0e95cf8b50a5e31d8042e26"
    }
    "over-yonder.tech/0c1398715e3cb8550370fb3fc3a85dcf" = {
      zone     = "over-yonder.tech"
      name     = "over-yonder.tech"
      type     = "CNAME"
      content  = "over-yonder-tech.pages.dev"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "0c1398715e3cb8550370fb3fc3a85dcf"
    }
    "over-yonder.tech/14e7f422f545478999f122807a62d96e" = {
      zone     = "over-yonder.tech"
      name     = "www.over-yonder.tech"
      type     = "CNAME"
      content  = "overyonder.github.io"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "14e7f422f545478999f122807a62d96e"
    }
    "over-yonder.tech/23b54b7d594d4c1e7e0caf5e66976ac8" = {
      zone     = "over-yonder.tech"
      name     = "over-yonder.tech"
      type     = "MX"
      content  = "in1-smtp.messagingengine.com"
      ttl      = 1
      proxied  = false
      priority = 10
      comment  = null
      live_id  = "23b54b7d594d4c1e7e0caf5e66976ac8"
    }
    "over-yonder.tech/2b5ee673702194164007a063e83d87e8" = {
      zone     = "over-yonder.tech"
      name     = "_dmarc.over-yonder.tech"
      type     = "TXT"
      content  = "v=DMARC1; p=none;"
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "2b5ee673702194164007a063e83d87e8"
    }
    "over-yonder.tech/40828f92a2e61211b3d5cf6ce5471ef8" = {
      zone     = "over-yonder.tech"
      name     = "fm2._domainkey.over-yonder.tech"
      type     = "CNAME"
      content  = "fm2.over-yonder.tech.dkim.fmhosted.com"
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "40828f92a2e61211b3d5cf6ce5471ef8"
    }
    "over-yonder.tech/44c97a4e0e41f6beeb3d316a5f619e96" = {
      zone     = "over-yonder.tech"
      name     = "over-yonder.tech"
      type     = "TXT"
      content  = "google-site-verification=ZCeT2gMTVu0SVP5PU6xLSRbCyKH80Ve8yGAYtaDqDT4"
      ttl      = 60
      proxied  = false
      priority = null
      comment  = null
      live_id  = "44c97a4e0e41f6beeb3d316a5f619e96"
    }
    "over-yonder.tech/46dc95dfe891433c29252316f967dadf" = {
      zone     = "over-yonder.tech"
      name     = "archivist.over-yonder.tech"
      type     = "CNAME"
      content  = "archivist-5e1.pages.dev"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "46dc95dfe891433c29252316f967dadf"
    }
    "over-yonder.tech/4f1b6f46a9450d32114023d86e0d608d" = {
      zone     = "over-yonder.tech"
      name     = "pong.over-yonder.tech"
      type     = "CNAME"
      content  = "pong-ai-7wt.pages.dev"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "4f1b6f46a9450d32114023d86e0d608d"
    }
    "over-yonder.tech/53e71201d0f0ff9379f1b2cc7a1261d0" = {
      zone     = "over-yonder.tech"
      name     = "fm1._domainkey.over-yonder.tech"
      type     = "CNAME"
      content  = "fm1.over-yonder.tech.dkim.fmhosted.com"
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "53e71201d0f0ff9379f1b2cc7a1261d0"
    }
    "over-yonder.tech/54caf2ba383fb34145fb11abff3b1754" = {
      zone     = "over-yonder.tech"
      name     = "eco.over-yonder.tech"
      type     = "CNAME"
      content  = "overyonder.github.io"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "54caf2ba383fb34145fb11abff3b1754"
    }
    "over-yonder.tech/6158bac4f9ae63fee9bddfb18ef33a9b" = {
      zone     = "over-yonder.tech"
      name     = "over-yonder.tech"
      type     = "TXT"
      content  = "v=spf1 include:spf.messagingengine.com ?all"
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "6158bac4f9ae63fee9bddfb18ef33a9b"
    }
    "over-yonder.tech/ad75645470729f0be1f9c7244aa5b303" = {
      zone     = "over-yonder.tech"
      name     = "openzt2.over-yonder.tech"
      type     = "CNAME"
      content  = "openzt2.pages.dev"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "ad75645470729f0be1f9c7244aa5b303"
    }
    "over-yonder.tech/d4419b395caca93da65c5775dd6b2b03" = {
      zone     = "over-yonder.tech"
      name     = "_github-pages-challenge-overyonder.over-yonder.tech"
      type     = "TXT"
      content  = "\"8632ed7f5d3f700c12317bff79966e\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "d4419b395caca93da65c5775dd6b2b03"
    }
    "over-yonder.tech/d485b35d2d57157c163b14ea3afc5fa3" = {
      zone     = "over-yonder.tech"
      name     = "fm3._domainkey.over-yonder.tech"
      type     = "CNAME"
      content  = "fm3.over-yonder.tech.dkim.fmhosted.com"
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "d485b35d2d57157c163b14ea3afc5fa3"
    }
    "polymyth.dev/1d72686692e64ad687f244a940e42125" = {
      zone     = "polymyth.dev"
      name     = "polymyth.dev"
      type     = "MX"
      content  = "route3.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 63
      comment  = null
      live_id  = "1d72686692e64ad687f244a940e42125"
    }
    "polymyth.dev/23f92602b0f9048d103ffe9fcfd5d22f" = {
      zone     = "polymyth.dev"
      name     = "polymyth.dev"
      type     = "MX"
      content  = "route2.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 96
      comment  = null
      live_id  = "23f92602b0f9048d103ffe9fcfd5d22f"
    }
    "polymyth.dev/36483ed88ac1c73a0185088de907c5d8" = {
      zone     = "polymyth.dev"
      name     = "polymyth.dev"
      type     = "TXT"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "36483ed88ac1c73a0185088de907c5d8"
    }
    "polymyth.dev/3ca7f7fb816c4b3cbdac964dacdd321b" = {
      zone     = "polymyth.dev"
      name     = "cf2024-1._domainkey.polymyth.dev"
      type     = "TXT"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "3ca7f7fb816c4b3cbdac964dacdd321b"
    }
    "polymyth.dev/59ca2e35f9ac4aa525abe04cae83a8a8" = {
      zone     = "polymyth.dev"
      name     = "www.polymyth.dev"
      type     = "CNAME"
      content  = "parkingpage.namecheap.com"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "59ca2e35f9ac4aa525abe04cae83a8a8"
    }
    "polymyth.dev/893c00c68eb2a957cc94a7d0d12cb5b5" = {
      zone     = "polymyth.dev"
      name     = "polymyth.dev"
      type     = "MX"
      content  = "route1.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 14
      comment  = null
      live_id  = "893c00c68eb2a957cc94a7d0d12cb5b5"
    }
    "polymyth.dev/d4e3773184e12e7d87017a8a3c670c5d" = {
      zone     = "polymyth.dev"
      name     = "polymyth.dev"
      type     = "A"
      content  = "162.255.119.79"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "d4e3773184e12e7d87017a8a3c670c5d"
    }
    "rake-lang.org/2a2fa9e56817def6038226f69f574583" = {
      zone     = "rake-lang.org"
      name     = "cf2024-1._domainkey.rake-lang.org"
      type     = "TXT"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "2a2fa9e56817def6038226f69f574583"
    }
    "rake-lang.org/5d7c259968915e1352514af2c068b5dd" = {
      zone     = "rake-lang.org"
      name     = "rake-lang.org"
      type     = "TXT"
      content  = "google-site-verification=50zYMGIuVX0Mi53qRqcS0gKObcxhbV9Jy4cFKXYSfmU"
      ttl      = 60
      proxied  = false
      priority = null
      comment  = null
      live_id  = "5d7c259968915e1352514af2c068b5dd"
    }
    "rake-lang.org/5de5d58a8d89b123c6e4930ec4bdf10b" = {
      zone     = "rake-lang.org"
      name     = "_github-pages-challenge-rakelang.rake-lang.org"
      type     = "TXT"
      content  = "\"381c5ffb5210d19901503bea09df0e\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "5de5d58a8d89b123c6e4930ec4bdf10b"
    }
    "rake-lang.org/60ef71717b7ccb3b34292c69465bc8bf" = {
      zone     = "rake-lang.org"
      name     = "rake-lang.org"
      type     = "MX"
      content  = "route2.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 69
      comment  = null
      live_id  = "60ef71717b7ccb3b34292c69465bc8bf"
    }
    "rake-lang.org/6307e184965173cc143083c5194251ba" = {
      zone     = "rake-lang.org"
      name     = "rake-lang.org"
      type     = "MX"
      content  = "route3.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 18
      comment  = null
      live_id  = "6307e184965173cc143083c5194251ba"
    }
    "rake-lang.org/9f24fe67dfa45433759633e8284b06af" = {
      zone     = "rake-lang.org"
      name     = "rake-lang.org"
      type     = "MX"
      content  = "route1.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 72
      comment  = null
      live_id  = "9f24fe67dfa45433759633e8284b06af"
    }
    "rake-lang.org/ab777d211b7eb3a3d33d21825de60c5a" = {
      zone     = "rake-lang.org"
      name     = "www.rake-lang.org"
      type     = "CNAME"
      content  = "rakelang.github.io"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "ab777d211b7eb3a3d33d21825de60c5a"
    }
    "rake-lang.org/c2ceb4472583fe9664da6670ae04a748" = {
      zone     = "rake-lang.org"
      name     = "rake-lang.org"
      type     = "CNAME"
      content  = "rake-lang.pages.dev"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "c2ceb4472583fe9664da6670ae04a748"
    }
    "rake-lang.org/e85ce633df6ddceae9f81dfe93771449" = {
      zone     = "rake-lang.org"
      name     = "rake-lang.org"
      type     = "TXT"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "e85ce633df6ddceae9f81dfe93771449"
    }
    "re-fill.co/8834b62bcc8e4a2bdfb8900aeec8206d" = {
      zone     = "re-fill.co"
      name     = "re-fill.co"
      type     = "MX"
      content  = "route2.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 35
      comment  = null
      live_id  = "8834b62bcc8e4a2bdfb8900aeec8206d"
    }
    "re-fill.co/8bf8d3677dd6acdb52b8d94310637e28" = {
      zone     = "re-fill.co"
      name     = "re-fill.co"
      type     = "MX"
      content  = "route1.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 68
      comment  = null
      live_id  = "8bf8d3677dd6acdb52b8d94310637e28"
    }
    "re-fill.co/cafb951cd3d99b1126ac6f21fecb7f98" = {
      zone     = "re-fill.co"
      name     = "re-fill.co"
      type     = "A"
      content  = "192.64.119.25"
      ttl      = 1
      proxied  = true
      priority = null
      comment  = null
      live_id  = "cafb951cd3d99b1126ac6f21fecb7f98"
    }
    "re-fill.co/d188260f09d7107fff010f5caee6f69f" = {
      zone     = "re-fill.co"
      name     = "cf2024-1._domainkey.re-fill.co"
      type     = "TXT"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "d188260f09d7107fff010f5caee6f69f"
    }
    "re-fill.co/d61a41751f457827aa23e669f7c1c1d7" = {
      zone     = "re-fill.co"
      name     = "re-fill.co"
      type     = "TXT"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "d61a41751f457827aa23e669f7c1c1d7"
    }
    "re-fill.co/ee4ac681b2cb1854e58b450b1290262a" = {
      zone     = "re-fill.co"
      name     = "re-fill.co"
      type     = "MX"
      content  = "route3.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 27
      comment  = null
      live_id  = "ee4ac681b2cb1854e58b450b1290262a"
    }
    "thought-led.com/10b0da721380d9651d36c37114a342d3" = {
      zone     = "thought-led.com"
      name     = "thought-led.com"
      type     = "TXT"
      content  = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "10b0da721380d9651d36c37114a342d3"
    }
    "thought-led.com/3c164ac26430302f224bcad1b7cf2de3" = {
      zone     = "thought-led.com"
      name     = "thought-led.com"
      type     = "MX"
      content  = "route2.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 14
      comment  = null
      live_id  = "3c164ac26430302f224bcad1b7cf2de3"
    }
    "thought-led.com/56669efe3060dfb92e03ef76c40c16da" = {
      zone     = "thought-led.com"
      name     = "cf2024-1._domainkey.thought-led.com"
      type     = "TXT"
      content  = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
      ttl      = 1
      proxied  = false
      priority = null
      comment  = null
      live_id  = "56669efe3060dfb92e03ef76c40c16da"
    }
    "thought-led.com/98827a7f265f9e9a2df08f1fde478957" = {
      zone     = "thought-led.com"
      name     = "thought-led.com"
      type     = "MX"
      content  = "route1.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 57
      comment  = null
      live_id  = "98827a7f265f9e9a2df08f1fde478957"
    }
    "thought-led.com/da7fdb4ef81f7bda42a65067f5b04a13" = {
      zone     = "thought-led.com"
      name     = "thought-led.com"
      type     = "MX"
      content  = "route3.mx.cloudflare.net"
      ttl      = 1
      proxied  = false
      priority = 68
      comment  = null
      live_id  = "da7fdb4ef81f7bda42a65067f5b04a13"
    }
  }
}

resource "cloudflare_dns_record" "shared" {
  for_each = local.shared_dns_records

  zone_id  = cloudflare_zone.zones[each.value.zone].id
  name     = each.value.name
  type     = each.value.type
  content  = each.value.content
  ttl      = each.value.ttl
  proxied  = each.value.proxied
  priority = each.value.priority
  comment  = each.value.comment
}

# The record itself is IaC-owned, while the address is intentionally mutated by
# the separately declared DDNS service.
resource "cloudflare_dns_record" "dynamic_home_address" {
  zone_id = cloudflare_zone.zones["kai.systems"].id
  name    = "dyn.kai.systems"
  type    = "A"
  content = "159.196.118.137"
  ttl     = 120
  proxied = false

  lifecycle {
    ignore_changes = [content]
  }
}
