# Changelog

## Unreleased (dev)
- Add API endpoints for bulk downloads, folder create/delete, move, rename, and health checks.
- Add API rate limiting middleware and stricter security headers.
- Add env validation, API response helpers, and storage path/bucket/filename security validation.
- Refresh web UI components (files, uploads, logs) and add a confirm modal.
- Add `ENABLE_EMOJI` flag to disable emoji in CLI output.

## Unreleased (main)
- Add basic web UI support (files (drop&drop), uploads, logs).
- Add roadmap in TODO.md and project context in claude.md.

## Unreleased (v1 branch)
- Fix interactive menu numbering and selection.
- Remove emoji from CLI output for CMD compatibility.

## v1.1.0
- Differentiate batch files for interactive vs CLI use.
- Auto-create .env and simplify setup in batch files.

## v1.0.0
- Add Windows batch files for CLI usage.
- Add Next.js web UI with dark theme.

## Initial
- Initial Supabase uploader CLI.