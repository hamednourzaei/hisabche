# Working notes — sales documents

Two agents read the repository independently.

```
.agent-notes/
  reading-manifest.md      the required order (both agents)
  agent-a/                 product analyst notes, one file per pass
  agent-b/                 sales script notes, one file per pass
```

Rules:

- One note per pass, named `00-orientation.md`, `01-product.md`, … `09-gaps.md`.
- A note lists: files read, facts proven (file + symbol), facts not proven,
  deliberately skipped, and open questions.
- A note never contains a claim without its file path.
- If a document and the code disagree, the code wins and the note says so.
- Notes are internal. They are never copied into `docs/sales/` customer files.
