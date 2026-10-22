# Changelog

## 0.5.0 · 2026-10-22

- Add local MCP tools for context, categories, task search and task creation.
- Add AI connection settings and generated Codex / Claude configuration.
- Refresh task lists and orb counts immediately after AI additions.
- Serialize GUI and AI writes; reject outdated GUI snapshots and preserve open editor drafts.
- Persist request IDs to prevent duplicate additions on retries.
- Publish English and Chinese setup documentation and actual interaction GIFs.
- Build Windows x64, macOS Apple Silicon and macOS Intel installers separately.

## 0.4.2

- Localize common custom category names without changing their stored names.
- Add optional English and Chinese labels for any category.
- Keep bilingual labels across restart and JSON backup round trips.

## 0.4.1

- Reduce orb fill and shadow; retain a nearly clear center and subtle glass rim.
- Keep logo/count contrast independent from the glass surface.

## 0.4.0

- Position the orb above the list and reveal the panel downward.
- Show the P logo for zero To-do items, otherwise the full To-do count.
- Preserve the orb anchor when expanding and reversing a collapse.

## 0.3.0

- Replace the original dashboard with a translucent note and grouped task list.
- Add hover focus and collapsible category groups.
- Retire the unedited Career category and its job-search templates while preserving user tasks and custom names.

## 0.2.0

- Add English-default / Chinese interface switching and editable categories.
- Simplify visual styling and neutralize interface copy.
- Verify local tasks, time calculations, backup/restore and basic desktop interactions.
