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
  | map(select(
      .name as $name
      | .full_name as $full_name
      | (
          [
            "3DPrintMe",
            "CITS3003",
            "CITS3200",
            "Tennis-Ball-Collecting-Robot",
            "aea",
            "hannigancooper.github.io",
            "langs",
            "nixup",
            "unity-copilot-docker-demo"
          ] | index($name)
        ) == null
      and (
          [
            "hannigancooper/hannigancooper.github.io"
          ] | index($full_name)
        ) == null
    ))
  | unique_by(.name)
  | sort_by(-.stargazers_count, .name)
  | map({
      name,
      full_name,
      html_url,
      stargazers_count
    })
' "$TMP" > "$OUT"
