#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <base-sha> <head-sha>" >&2
  exit 2
fi

BASE_SHA="$1"
HEAD_SHA="$2"

CHANGED="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")"

echo "Changed files:"
echo "$CHANGED"

if echo "$CHANGED" | grep -Eq '^(src/|scripts/|package\.json|README\.md)'; then
  if ! echo "$CHANGED" | grep -q '^CHANGELOG\.md$'; then
    echo "ERROR: CHANGELOG.md must be updated when behavior-visible files change in a PR." >&2
    exit 1
  fi
fi
