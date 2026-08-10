// ============================================
// Dashboard — the shared screen, mounted unmodified.
//
// This page used to be a private reimplementation: four KPI tiles against the
// raw analytics hooks, its own quick-action card, and copy from a desktop-only
// i18n namespace. It drifted — different metrics from web, different actions,
// and two of its buttons pointed at `/sales/new` and `/inventory`, paths the
// router only keeps as redirects.
//
// Mounting `DashboardContainer` puts desktop on the same date-range picker,
// the same KPI set, the same chart, insights and recent-activity panels the web
// dashboard shows, from one implementation. `metric-tile.tsx` and
// `sales-chart.tsx` went with it; the shared view carries its own.
// ============================================

import React from 'react'
import { DashboardContainer } from '@hisabche/ui/screens'

export default function DashboardPage() {
  return <DashboardContainer />
}
