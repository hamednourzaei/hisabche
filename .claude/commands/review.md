---
description: Review the working diff for real defects
---

Review the current changes using the `hisabche-code-review` skill.

Start from `git diff` (and `git diff --staged`). Read enough surrounding code to
judge correctness — a diff alone hides most real bugs.

Order: correctness → security → domain semantics → i18n → UI consistency →
types → tests. Report most severe first, each with file, line, what breaks, and
the input or state that triggers it. If you cannot describe the failure, leave
it out.

Pay particular attention to the domain's sharp edges: `invoice.type` assumed to
be `sale`, purchases counted as revenue, quantity/unit/weight collapsed, `0`
treated as absent, authorization trusting a body field.
