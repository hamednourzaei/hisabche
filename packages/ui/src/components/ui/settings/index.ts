export { SettingsPage } from './settings-page'

// Exported separately so the app-shell (Windows / Android) settings page mounts
// the real sections instead of growing second copies. Both depend only on
// shared hooks and on host adapters the shell registers at start-up (the
// receipt printer host, the camera scanner).
export { BusinessStampSection } from './settings-page'
export { HardwareSection } from './hardware-section'
