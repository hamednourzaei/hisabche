# Concurrency Report

Operation A: Finalize Invoice X
Operation B: Finalize Invoice X (Simultaneous)
Ordering: Race
Result A: Success
Result B: Rejected (Conflict)
Journal State: 1 Entry
Invoice State: Finalized
Balance State: Accurate
Duplicate Posting?: No
Status: VERIFIED
