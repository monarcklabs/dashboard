'use client'

import { StakeholderPage } from '@/components/stakeholder/StakeholderPage'

export default function DashboardRoute() {
  return (
    <StakeholderPage
      audienceLabel="Dashboard"
      summaryPath="/api/client/summary"
      exportPath="/api/client/export"
    />
  )
}
