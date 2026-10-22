# Helper arguments

Read-only commands:

- `context`: no arguments; returns local date, timezone, language, revision and counts.
- `categories`: no arguments; returns category IDs and English / Chinese names. The empty string is Uncategorized.
- `tasks`: optional JSON fields `status` (`todo`, `doing`, `done`), `categoryId`, `date` (`YYYY-MM-DD`), `query`, `limit` (1–100, default 50), `offset` (default 0). Follow `nextOffset` for later pages when needed.

`add` accepts JSON fields:

```json
{
  "title": "Review CV",
  "status": "todo",
  "categoryId": "study",
  "date": "2026-10-22",
  "time": { "mode": "start", "start": "15:00" },
  "requestId": "a-unique-id-for-this-user-request"
}
```

The date and category above are examples. Use context for the actual date, categories for actual IDs, and the human's requested values. `title` is required (1–240 characters). Other fields may be omitted; defaults are To-do, Uncategorized, no date and no time. Do not guess a category ID. Use Uncategorized if the user did not choose a category and no existing category is clearly appropriate; clarify when the distinction matters.

Time forms:

```json
{"mode":"none"}
{"mode":"start","start":"15:00"}
{"mode":"duration","durationMinutes":90}
{"mode":"range","start":"19:00","end":"20:30"}
```

Times use 24-hour `HH:MM`. Ranges can cross midnight; equal start/end is invalid. A start-only time requires Pebble 0.6 or later; do not invent an end time for an older app. Missing duration/end is not permission to guess either. Durations must be 1–10080 minutes.

The helper generates a request ID if omitted and includes it in both success and error output for retry recovery. Prefer placing your own unique ID in the input file so a retry can reuse the same file. The app stores IDs to avoid duplicate additions across restarts. Never reuse an ID for a different requested task.
