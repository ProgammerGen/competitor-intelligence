---
name: Always output AC/Questions/Assumptions before implementing
description: CLAUDE.md requires outputting acceptance criteria, questions, and assumptions as text in the conversation before any implementation begins — even if plan mode was used
type: feedback
---

Always output ACCEPTANCE CRITERIA, ASK ME QUESTIONS, and ANY ASSUMPTIONS MADE as visible text in the conversation before starting any implementation on a new feature request.

**Why:** The user has corrected this multiple times. The CLAUDE.md workflow section requires it. Plan mode does not substitute for this — the user needs to see and approve these in the conversation, not buried in a plan file.

**How to apply:** After plan approval (or before implementation if no plan mode), write out all three sections as formatted text. Wait for user confirmation before writing any code. Do this for every new feature request, no exceptions.
