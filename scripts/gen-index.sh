#!/usr/bin/env bash
# Scans articles/*.md, extracts YAML front matter, emits articles/index.json
# sorted by date descending.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$REPO_ROOT/articles"
OUT="$DIR/index.json"

entries=()

for f in "$DIR"/*.md; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"

  # Extract front matter between --- delimiters
  in_fm=0
  title="" date="" author=""
  tags_raw=""

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
      esac
    fi
  done < "$f"

  # Convert tags [a, b, c] to JSON array
  tags_json="$(echo "$tags_raw" | sed 's/^\[//;s/\]$//;s/,/\n/g' | \
    awk '{gsub(/^ +| +$/,"",$0); if(length($0)>0) printf "%s\"%s\"", (NR>1?", ":""), $0}' | \
    awk '{print "["$0"]"}')"

  entries+=("{\"file\":\"$fname\",\"title\":\"$title\",\"date\":\"$date\",\"author\":\"$author\",\"tags\":$tags_json}")
done

# Sort by date descending, emit JSON array
if [ ${#entries[@]} -eq 0 ]; then
  echo "[]" > "$OUT"
else
  printf '%s\n' "${entries[@]}" | sort -t'"' -k8 -r | \
    awk 'BEGIN{printf "[\n"} NR>1{printf ",\n"} {printf "  %s",$0} END{printf "\n]\n"}' > "$OUT"
fi
