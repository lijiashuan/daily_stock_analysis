# Archived One-Time Scripts

This directory contains one-time scripts that were previously in the project root.
They are kept for historical reference but are not part of the active codebase.

## Categories

### PortfolioPage.tsx Fix Scripts (2026-05)

These scripts were used iteratively to fix JSX closing tags in `apps/dsa-web/src/pages/PortfolioPage.tsx`.
The fix has been applied; these scripts are no longer needed.

- `add_confirm.py`, `add_confirm_final.py` — Add ConfirmDialog component
- `fix_confirm.py` — Fix ConfirmDialog placement
- `fix_final.py`, `fix_final2.py`, `fix_proper.py`, `fix_correct.py` — Fix closing tags
- `fix_tags2.py`, `fix_tags3.py`, `fix_tags4.py` — Fix redundant closing tags
- `restore_correct.py`, `restore_file.py` — Restore correct file state

### Git Push Helper Scripts

These scripts contained hardcoded paths and commit messages for a specific push.
Use standard `git` commands or `scripts/sync_upstream.ps1` instead.

- `direct_git_push.py`, `git_push_helper.py`, `push_changes.bat`, `git_push_ssh.ps1`
- `GIT_PUSH_INSTRUCTIONS.md`, `git_push_output.log`

### One-Time Test / Debug Scripts

- `check_close_prices.py` — Check close prices for specific stocks in DB
- `quick_test_pdf.py` — Quick test PDF export functionality
- `test_cash_import.py` — Test cash ledger CSV parsing (hardcoded local path)
- `test_export_formats.py` — Test report export in multiple formats
- `test_pdf_rtf_fix.py` — Test PDF and RTF export fix
