#!/usr/bin/env bash
# Verifies every commit (and the local git identity) is authored by "Aashna".
set -euo pipefail
EXPECTED="Aashna"
cfg="$(git config user.name || true)"
if [ "$cfg" != "$EXPECTED" ]; then
  echo "git user.name is '${cfg:-<unset>}', expected '$EXPECTED'. Fix with: git config user.name \"$EXPECTED\"" >&2
  exit 1
fi
bad="$(git log --format='%h %an | %cn' | awk -F' [|] ' '{split($1,a," "); an=substr($1,index($1," ")+1); if (an!="'"$EXPECTED"'" || $2!="'"$EXPECTED"'") print}')"
if [ -n "$bad" ]; then
  echo "Commits not authored/committed by $EXPECTED:" >&2; echo "$bad" >&2; exit 1
fi
echo "OK: identity and all commits are '$EXPECTED'."
