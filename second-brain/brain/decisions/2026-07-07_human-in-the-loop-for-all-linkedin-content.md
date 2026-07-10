# Decision: Human-in-the-loop for all LinkedIn content

**Date:** 2026-07-07
**Status:** Active

We decided that no AI-generated LinkedIn content is ever auto-posted. Every draft passes through the operator_os Review Queue (pending_review → approved → scheduled → posted) with the owner as the only approver, enforced by DB CHECK constraints, not just app logic.

**Because:** the owner's audience includes hiring managers and senior engineers (FDE target roles); a single inflated or wrong claim costs more than a month of good posts earns. Claim-status honesty ([[2026-07-07_claim-status-system-for-content-honesty]]) only works if a human verifies it.

Related: [[2026-07-07_lesson-enforce-invariants-at-the-database-layer]]
