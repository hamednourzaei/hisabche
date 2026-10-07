# Test Quality

A large portion of the UI tests (1013) provide FALSE-CONFIDENCE (E) as they test React rendering and mocking, not actual user behaviors or persistence.
The backend tests (3671) are a mix of HIGH-VALUE BEHAVIOR (A) and MEDIUM-VALUE (B) integration tests.

Examples of false confidence:
- React Query hooks mocked out instead of checking the actual optimistic state transition.
- Offline behavior completely stubbed out.
