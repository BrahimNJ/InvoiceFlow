#!/usr/bin/env bash
# Publishes shields.io endpoint files (https://shields.io/badges/endpoint-badge) to the `badges` branch, which
# the README reads through https://img.shields.io/endpoint?url=<raw file URL>. No third-party service involved.
#
# Usage: publish-badges.sh <file.json>...   (needs GITHUB_TOKEN with contents: write, GITHUB_REPOSITORY)
# Several workflows publish to the same branch: a rejected push is retried on top of the latest badges commit.
set -euo pipefail

repo_url="https://github.com/${GITHUB_REPOSITORY}.git"
# The token travels as a header, like actions/checkout does, and is never written to a .git/config
auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
git_auth() { git -c http.extraheader="$auth" "$@"; }
workdir=$(mktemp -d)

for attempt in 1 2 3 4 5; do
  rm -rf "$workdir"
  # Exit code 2: the branch does not exist yet. Any other failure (authentication, network) stops here.
  status=0
  git_auth ls-remote --exit-code --heads "$repo_url" badges > /dev/null || status=$?
  if [ "$status" -eq 0 ]; then
    git_auth clone --quiet --depth 1 --branch badges "$repo_url" "$workdir"
  elif [ "$status" -eq 2 ]; then
    # First publication: start the branch with no history from main
    git init --quiet "$workdir"
    git -C "$workdir" checkout --quiet --orphan badges
    git -C "$workdir" remote add origin "$repo_url"
  else
    echo "::error::Cannot reach ${repo_url} (git ls-remote exit code ${status})"
    exit 1
  fi
  cp "$@" "$workdir/"
  git -C "$workdir" add --all
  if git -C "$workdir" diff --cached --quiet; then
    echo "Badges unchanged"
    exit 0
  fi
  git -C "$workdir" -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit --quiet -m "chore: update badges from ${GITHUB_WORKFLOW:-CI} (${GITHUB_SHA:0:7})"
  if git_auth -C "$workdir" push --quiet origin badges; then
    echo "Published: $*"
    exit 0
  fi
  sleep $((attempt * 3))
done

echo "::error::Could not push to the badges branch after 5 attempts"
exit 1
