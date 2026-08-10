export { SettingsPage } from './settings-page'

// Exported separately so the Electron settings page can mount the real stamp
// uploader instead of growing a second one — it depends only on the workspace
// hooks, which desktop already uses.
export { BusinessStampSection } from './settings-page'
