"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardView } from "@/components/dashboard-view"
import { PropertyDatabaseView } from "@/components/property-database-view"
import { Activity, Database } from "lucide-react"

export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 lg:px-6 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg lg:text-xl font-bold tracking-tight">Dashboard de Monitoreo</h1>
              <p className="text-muted-foreground mt-1 text-sm lg:text-base">Sistema de control operacional de scrapers</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card w-fit">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-medium">Sistema activo</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 lg:px-6 py-6 lg:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity className="h-4 w-4" />
              Monitoreo
            </TabsTrigger>
            <TabsTrigger value="properties" className="gap-2">
              <Database className="h-4 w-4" />
              Base de Datos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardView />
          </TabsContent>

          <TabsContent value="properties">
            <PropertyDatabaseView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
