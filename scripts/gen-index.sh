#!/usr/bin/env bash
# Scans articles/*.md, extracts YAML front matter, emits articles/index.json
# sorted by front matter date (newest first).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$REPO_ROOT/articles"
OUT="$DIR/index.json"

entries=()

# Read articles, then sort by front matter date newest-first.
while IFS= read -r f; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"

  # Extract front matter between --- delimiters
  in_fm=0
  title="" date="" author=""
  tags_raw=""
  hidden="false"

  while IFS= read -r line; do
    if [ "$in_fm" -eq 0 ] && [ "$line" = "---" ]; then
      in_fm=1; continue
    fi
    if [ "$in_fm" -eq 1 ] && [ "$line" = "---" ]; then
      break
    fi
    if [ "$in_fm" -eq 1 ]; then
      key="${line%%:*}"
      val="${line#*: }"
      case "$key" in
        title)  title="$(echo "$val" | sed 's/^"//;s/"$//')" ;;
        date)   date="$val" ;;
        author) author="$val" ;;
        tags)   tags_raw="$val" ;;
        hidden)
          val="$(echo "$val" | tr '[:upper:]' '[:lower:]' | sed 's/^"//;s/"$//')"
          if [ "$val" = "true" ]; then
            hidden="true"
          else
            hidden="false"
          fi
          ;;
      esac
    fi
  done < "$f"

  # Convert tags [a, b, c] to JSON array
  tags_json="$(echo "$tags_raw" | sed 's/^\[//;s/\]$//;s/,/\n/g' | \
    awk '{gsub(/^ +| +$/,"",$0); if(length($0)>0) printf "%s\"%s\"", (NR>1?", ":""), $0}' | \
    awk '{print "["$0"]"}')"

  entries+=("$date	{\"file\":\"$fname\",\"title\":\"$title\",\"date\":\"$date\",\"author\":\"$author\",\"tags\":$tags_json,\"hidden\":$hidden}")
done < <(printf '%s\n' "$DIR"/*.md)

# Emit JSON array (sorted by date)
if [ ${#entries[@]} -eq 0 ]; then
  echo "[]" > "$OUT"
else
  printf '%s\n' "${entries[@]}" | \
    sort -r | \
    cut -f2- | \
    awk 'BEGIN{printf "[\n"} NR>1{printf ",\n"} {printf "  %s",$0} END{printf "\n]\n"}' > "$OUT"
fi
