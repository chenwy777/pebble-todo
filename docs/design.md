# v0.2 visual direction

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

English is the initial interface language. A visible 中文 / EN button and Settings → Language switch the interface, built-in labels, feedback, time formatting and native menus. Task content and custom category/template names are never machine-translated.
