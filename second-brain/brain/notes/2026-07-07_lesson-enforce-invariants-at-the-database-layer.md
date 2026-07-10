# Lesson: Enforce invariants at the database layer, not just app code

**Date:** 2026-07-07

While building the LinkedIn OS, the post state machine (pending_review → approved → scheduled → posted / rejected) and claim levels were enforced twice: CHECK constraints in Postgres AND validation in the server action. The app-level check gives good errors; the DB-level check survives every future refactor, every new client of the database, and every AI-generated migration that forgets the rule.

**Transferable rule:** any invariant that would be catastrophic to violate (state machines, enum domains, ownership) gets a database constraint. App validation is UX; DB constraints are the law.

Related: [[2026-07-07_human-in-the-loop-for-all-linkedin-content]], [[2026-07-07_neon-better-auth-stack-for-operator-os]]
