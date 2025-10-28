"use client"
import { UpcomingExecutions } from "@/components/upcoming-executions"
import { GeneralStatus } from "@/components/general-status"
import { CityStatusTable } from "@/components/city-status-table"
import { AlertsPanel } from "@/components/alerts-panel"
import { PropertyInventory } from "@/components/property-inventory"

export function DashboardView() {
  return (
    <div className="space-y-6">
      {/* Top Row: Upcoming Executions and General Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <UpcomingExecutions />
        <GeneralStatus />
      </div>

      {/* City Status Table */}
      <CityStatusTable />

      {/* Bottom Row: Alerts and Property Inventory */}
      <div className="grid gap-6 md:grid-cols-2">
        <AlertsPanel />
        <PropertyInventory />
      </div>
    </div>
  )
}
