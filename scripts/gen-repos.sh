#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO_ROOT/data/repos.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

ACCOUNTS=(
  rakelang
  overyonder
  hannigancooper
  KaiStarkk
)

for account in "${ACCOUNTS[@]}"; do
  curl -fsSL "https://api.github.com/users/$account/repos?per_page=100&sort=updated" >> "$TMP"
  printf '\n' >> "$TMP"
done

jq -s '
  flatten
  | map(select((.fork | not) and (.private | not)))
  | unique_by(.name)
  | sort_by(-.stargazers_count, .name)
  | map({
      name,
      full_name,
      html_url,
      stargazers_count
    })
' "$TMP" > "$OUT"
