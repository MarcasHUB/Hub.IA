# B1-R.6 — Zero runtime mock audit

Baseline: `cfea85bed3e668422142374bb8c7af5084f10a7a`.

The baseline search produced 117 textual matches. Those matches were reviewed by source, not blindly deleted.

- `RUNTIME_MOCK`: 20 runtime sources. Removed or replaced with Supabase-backed behavior.
- `LEGACY_UNUSED`: 4 local-storage repository/service stacks (`User`, `Organization`, `Membership`, `Connection`). They have no runtime importers and were preserved for a separate, explicit cleanup.
- `REAL_CODE`: session cleanup, tenant cache isolation, and the chat sound preference. These uses do not hold domain truth.
- `DOCUMENTATION`: the landing-page “Mockup” JSX comment.
- `TEST_ONLY`: 1 test file exercises local-storage isolation; preserved.

The final critical-source gate searches for the quotation keys, signal seed/key, chat partner key, mock quotation map, random business generation, named demo suppliers/products, visible TBD, and “Em breve”. It returns zero matches in `src/`.
