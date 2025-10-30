"use client"
import { useEffect, useState } from "react"
import { UpcomingExecutions } from "@/components/upcoming-executions"
import { GeneralStatus } from "@/components/general-status"
import { CityStatusTable } from "@/components/city-status-table"
import { AlertsPanel } from "@/components/alerts-panel"
import { PropertyInventory } from "@/components/property-inventory"
import { fetchDashboardData, type DashboardData } from "@/lib/api"

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const dashboardData = await fetchDashboardData()
        setData(dashboardData)
        setError(null)
      } catch (err) {
        setError('Error al cargar datos del dashboard')
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    // Cargar datos inicialmente
    loadData()

    // Actualizar cada 30 segundos
    const interval = setInterval(loadData, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* Top Row: Upcoming Executions and General Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <UpcomingExecutions executions={data?.next_executions || []} />
        <GeneralStatus summary={data?.summary || null} />
      </div>

      {/* City Status Table */}
      <CityStatusTable cities={data?.cities || []} />

      {/* Bottom Row: Alerts and Property Inventory */}
      <div className="grid gap-6 md:grid-cols-2">
        <AlertsPanel alerts={data?.alerts || []} />
        <PropertyInventory summary={data?.summary || null} />
      </div>
    </div>
  )
}