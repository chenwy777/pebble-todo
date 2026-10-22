# v0.2 visual direction

## v0.5 local AI connections

AI connection controls live in a settings dialog, keeping the floating note unchanged. One checkbox enables local access, with separate buttons to copy Codex TOML or Claude JSON configuration. The MCP server exposes four narrow tools: context, categories, task search and task creation. Natural language understanding stays with the chosen AI client.

The desktop app remains the sole writer. GUI snapshots and AI commands share a serialized service, with revision checks rejecting outdated GUI saves. AI events update the note without overwriting open task-editor fields, and discard old undo snapshots. Request IDs survive restart for deduplication. The local bridge is disabled by default, loopback-only when enabled, token-protected, and shut down on disable or exit.

## v0.4.2 custom category localization

All category headings, tags and selectors use the same label resolver: an explicit translation takes priority over a built-in label, then an exact match in the local common-category dictionary, then the original name. Only category labels use this dictionary; task text and custom template titles stay as entered. Category IDs and original names remain unchanged, including legacy custom `life` labels.

Category management keeps translations under a collapsed optional section for each category. Users can provide English and Chinese names independently, or clear a field to restore the fallback. These labels are validated and stored with the category, so restart, undo and JSON backup round trips retain them. Unknown names are never sent to an external translation service or guessed.

## v0.4.1 clear glass refinement

The floating orb has a nearly clear center (2.5% white tint), a restrained upper reflection and a fine asymmetric rim. The previous opaque gradient, broad blur and heavy inset highlight are removed, so the desktop remains visible through the circle. Hover brightens the rim without filling the center. Logo and count retain independent contrast rather than fading with the glass surface.

## v0.4 orb and opening direction

The orb now uses a translucent neutral gradient, a thin highlight border and a low-contrast monoline P logo. With zero To-do items the logo is visible; otherwise the actual To-do count occupies the center. Doing and Done are excluded. There is no corner badge or numeric cap.

The orb sits above the note. A top-origin clip and short translation reveal the panel downward in 260 ms. Retraction takes 180 ms, with the native window shrinking after 220 ms; reopening cancels that pending shrink and reverses the visual transition. System reduced-motion preferences disable the visual animation.

The orb remains anchored during normal expansion and collapse. At the left edge, the note grows to the right; near the bottom, the orb first moves upward far enough to fit the note. Native position changes are serialized with task saves.

## v0.3 reference update

The user's two supplied screenshots replace the earlier dashboard-like hierarchy with a translucent desktop note: a small centered date, monospaced text, category headings, simple checkboxes and a plain bottom entry field. No reference photographs, text content or third-party assets were copied into the application.

Task rows are grouped under collapsible category headings. Hovering scales a row to 1.025 and shifts it 2 px, while other rows scale to .98 and fade to .4 opacity. These transforms do not change the list flow. Keyboard focus also highlights a task; reduced-motion preferences disable scaling and movement. Moving away restores the rows.

Default opacity is 82%. The old default opacity migrates, while other user-selected values remain. The unedited built-in Career category and its unedited job-search templates are retired. Existing tasks are kept as uncategorized; renamed categories and custom templates are preserved.

References reviewed on 22 October 2026:

- [Things](https://culturedcode.com/things/) — reference for a restrained task list, clear type hierarchy and whitespace.
- [Todoist](https://www.todoist.com/features) — reference for keeping quick entry and categorization accessible in a compact list interface.

These are visual references, not copied layouts or assets. Pebble uses a small floating window rather than a full application sidebar.

The implementation uses a neutral white / gray palette, thin row dividers, one system font stack, restrained corner radii and a plain circular orb. Branding slogans, gradients, empty-state illustrations and separate task cards were removed. Category colors are small optional markers.

The main screen has only the date, progress, four tabs, category controls, task list and quick entry. Settings and time controls remain in dialogs. Category management is reachable from the main screen, settings, and each task/template category selector.

English is the initial interface language. A visible 中文 / EN button and Settings → Language switch the interface, built-in labels, feedback, time formatting and native menus. Category localization follows the v0.4.2 rules above; task content and custom template names stay as entered.
