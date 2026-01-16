"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardView } from "@/components/dashboard-view"
import { PropertyDatabaseView } from "@/components/property-database-view"
import { SimpleGoogleMap } from "@/components/simple-google-map"
import { PropertyValuation } from "@/components/property-valuation"
import { Activity, Database, MapPin, Calculator, Users } from "lucide-react"

export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  
  // Shared filter state
  const [sharedFilters, setSharedFilters] = useState({
    city_id: 'all',
    offer_type: 'all',
    min_price: '',
    max_price: '',
    min_sale_price: '',
    max_sale_price: '',
    min_rent_price: '',
    max_rent_price: '',
    min_area: '',
    max_area: '',
    rooms: 'any',
    baths: 'any',
    garages: 'any',
    stratum: 'any',
    antiquity: 'any',
    property_type: [] as string[],
    updated_date_from: '',
    updated_date_to: '',
    address: '',
    distance: '',
    latitude: null as number | null,
    longitude: null as number | null
  })

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
            <TabsTrigger value="market" className="gap-2">
              <MapPin className="h-4 w-4" />
              Análisis de Mercado
            </TabsTrigger>
            <TabsTrigger value="valuation" className="gap-2">
              <Calculator className="h-4 w-4" />
              Avalúo
            </TabsTrigger>
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2 hover:bg-muted text-foreground"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open('https://leads.toperty.co/', '_blank')
              }}
            >
              <Users className="h-4 w-4" />
              Leads
            </button>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardView />
          </TabsContent>

          <TabsContent value="properties">
            <PropertyDatabaseView />
          </TabsContent>

          <TabsContent value="market">
            <SimpleGoogleMap />
          </TabsContent>
          
          <TabsContent value="valuation">
            <PropertyValuation />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
