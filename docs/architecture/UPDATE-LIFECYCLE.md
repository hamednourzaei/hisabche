# Hisabche V13 — Update Lifecycle

## 1. 17-State Table-Driven FSM (`packages/updater-core/src/state-machine.ts`)

States: `UP_TO_DATE`, `CHECKING`, `UPDATE_AVAILABLE`, `DOWNLOADING`, `PAUSED`, `VERIFYING`, `COMPATIBILITY_CHECK`, `READY_TO_INSTALL`, `INSTALLING`, `ACTIVATING`, `RESTART_REQUIRED`, `ACTIVE`, `ROLLBACK_REQUIRED`, `ROLLING_BACK`, `FAILED`, `UNSUPPORTED`, `INCOMPATIBLE`.

Every `(state × event)` pair resolves to either a valid next state or `{ ok: false, code: 'INVALID_STATE_TRANSITION' }`.

## 2. Ordered Update Algorithm (`UpdateOrchestrator.runCoreUpdate`)

1. Acquire single-update lock (`CP_01_BEFORE_METADATA`) → fetch authenticated metadata → verify signature, sequence, and compatibility (`CP_02_AFTER_METADATA`).
2. Check power/Wi-Fi/low-battery/free-space policies (`CP_03_BEFORE_DOWNLOAD`).
3. Download resumable range with ETag validation (`CP_04_MID_DOWNLOAD` .. `CP_05_AFTER_DOWNLOAD`).
4. Verify SHA-256 (`CP_06_AFTER_HASH_VERIFY`) & Ed25519 signature (`CP_07_AFTER_SIGNATURE_VERIFY`).
5. Stage in inactive `.staging-<version>` slot (`CP_08_AFTER_STAGING_WRITE`).
6. Defer activation if `hasActiveFinancialTransaction()` is true (`I11`).
7. Atomic slot swap with bounded Windows AV retry (`CP_09_BEFORE_SLOT_SWAP` .. `CP_10_AFTER_SLOT_SWAP`).
8. Run local startup health check (`CP_11_BEFORE_HEALTH_CONFIRM` .. `CP_12_AFTER_HEALTH_CONFIRM`) — external backend outages never trigger rollback.
9. Record telemetry (`CP_13_BEFORE_TELEMETRY`) and clean obsolete slots while preserving `previousVersion` (`CP_14_BEFORE_CLEANUP`).
