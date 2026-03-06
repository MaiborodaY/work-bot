# Local Editing Rules

- For `.js/.json/.md/.yml/.yaml` files, keep content in UTF-8.
- Prefer `apply_patch` for source edits.
- Do not use `Set-Content`, `Add-Content`, `Out-File`, or redirection writes for source files unless encoding is explicitly UTF-8.
- If shell output looks garbled, verify file bytes before changing text.
