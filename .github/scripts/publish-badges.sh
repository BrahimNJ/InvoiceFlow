#!/usr/bin/env bash
# Publishes shields.io endpoint files (https://shields.io/badges/endpoint-badge) to the `badges` branch, which
# the README reads through https://img.shields.io/endpoint?url=<raw file URL>. No third-party service involved.
#
# Usage: publish-badges.sh <file.json>...   (needs GITHUB_TOKEN with contents: write, GITHUB_REPOSITORY)
# Several workflows publish to the same branch: a rejected push is retried on top of the latest badges commit.
set -euo pipefail

repo_url="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
workdir=$(mktemp -d)

for attempt in 1 2 3 4 5; do
  rm -rf "$workdir"
  if ! git clone --quiet --depth 1 --branch badges "$repo_url" "$workdir" 2> /dev/null; then
    # First publication: start the branch with no history from main
    git init --quiet "$workdir"
    git -C "$workdir" checkout --quiet --orphan badges
    git -C "$workdir" remote add origin "$repo_url"
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
  if git -C "$workdir" push --quiet origin badges; then
    echo "Published: $*"
    exit 0
  fi
  sleep $((attempt * 3))
done

echo "::error::Could not push to the badges branch after 5 attempts"
exit 1
