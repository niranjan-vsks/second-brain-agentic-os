# Decision: Six-level claim-status system for content honesty

**Date:** 2026-07-07
**Status:** Active

Every LinkedIn post declares one of six claim levels before drafting: shipped / piloting / building / concept / insight / commentary. The level caps what the content may claim, is enforced in the Draft Composer's system prompt, and is stored as a CHECK-constrained column on `linkedin_posts`.

**Because:** AI drafting tools drift toward outcome language ("this boosted X by 40%") regardless of reality. Making honesty a structured input instead of a vibe makes it enforceable and auditable.

Related: [[2026-07-07_human-in-the-loop-for-all-linkedin-content]]
