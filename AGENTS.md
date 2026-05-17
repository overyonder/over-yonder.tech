## Site workflow

- This is a static site. Articles live in `articles/*.md`.
- `articles/index.json` is generated from article frontmatter with:
  `./scripts/gen-index.sh`
- Publishing is `git push` to `origin main`.
- After changing an article, regenerate `articles/index.json`, commit the site
  repo change, rebase on `origin/main` if needed, and push.
- Local preview can run with:
  `python3 -m http.server 8765 --bind 127.0.0.1`

