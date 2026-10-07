# False Confidence Ground Truth

CATEGORY: UI components lacking persistence tests.
EVIDENCE: Many `packages/ui` tests check that a component renders a specific class or optimistic state, but they mock React Query completely, providing no confidence that the actual data reaches the server successfully.
