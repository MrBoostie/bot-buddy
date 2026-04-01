#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MISSING=0

DOC_FILES=(README.md CONTRIBUTING.md CHANGELOG.md)
if [[ "$#" -gt 0 ]]; then
  DOC_FILES=("$@")
fi

check_link_target() {
  local source_file="$1"
  local target="$2"

  if [[ "$target" == http* ]] || [[ "$target" == "#"* ]]; then
    return 0
  fi

  local clean_target="${target%%\#*}"
  local resolved="$(cd "$(dirname "$source_file")" && realpath -m "$clean_target")"

  if [[ ! -e "$resolved" ]]; then
    echo "ERROR: $source_file references missing link target: $target" >&2
    MISSING=1
  fi
}

for file in "${DOC_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: expected doc missing: $file" >&2
    MISSING=1
    continue
  fi

  while IFS= read -r target; do
    [[ -z "$target" ]] && continue
    check_link_target "$file" "$target"
  done < <(
    grep -oE '\[[^]]+\]\([^)]+\)' "$file" 2>/dev/null \
      | sed -E 's/.*\(([^)]+)\)/\1/' || true
  )
done

if [[ "$MISSING" -ne 0 ]]; then
  echo "::error::Documentation link check failed."
  exit 1
fi

echo "Doc link check passed for: ${DOC_FILES[*]}"
