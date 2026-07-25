# OA V2 Production Evaluation Boundary

The frontend participates in production read-only evidence only as a consumer of the versioned public protocol. It is
never the authority for intent, task state, tool permission, recovery, or completion.

Before a backend canary is approved, the controlled browser run must use the immutable frontend revision recorded in
the approval request and prove that schema v3:

- displays authoritative slot values, sources, status, and editability;
- deduplicates a v3 event and its v2 projection by `eventId`;
- rejects unknown, sensitive, malformed, stale, and out-of-order payloads;
- preserves TaskDelta source-message identity across retry and requires rebase after conflict;
- observes `OA_VERIFICATION_COMPLETED` before presenting a read task as complete;
- never exposes private reasoning, raw prompts, complete tool payloads, credentials, or internal exceptions.

The live dataset, authentication cookie, screenshots containing business data, raw event stream, and generated reports
must remain in the controlled evidence store outside this repository. Only anonymized regression fixtures may return to
Git, and they must describe the failure category rather than embed production text or identifiers.
