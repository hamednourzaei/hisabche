#!/usr/bin/env bash
# Render build for the backend service.
# Kept as a script because Render's dashboard build-command field truncates
# long commands. Render's image has a read-only /usr/bin, so corepack cannot
# link pnpm — `npx -y pnpm@<version>` runs it from the npx cache instead.
set -euo pipefail

cd "$(dirname "$0")"

npx -y pnpm@11.9.0 install --frozen-lockfile

# No schema step. The database schema lives in docs/*-migration.sql and a person
# runs it (CLAUDE.md §0); the deploy never generates or applies migrations.
# `drizzle-kit generate` used to run here against backend/src/drizzle-schema.ts —
# a file nothing imported, removed as dead code (V61 preflight) — and every
# deploy then failed with «No schema files found» (12 Nov 2026).
