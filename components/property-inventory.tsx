"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, TrendingUp, RefreshCw } from "lucide-react"
import type { Summary } from "@/lib/api"

interface PropertyInventoryProps {
  summary: Summary | null
}

export function PropertyInventory({ summary }: PropertyInventoryProps) {
  const inventoryData = [
    { 
      label: "Propiedades Nuevas Hoy", 
      value: summary ? summary.properties_today.toLocaleString() : "0", 
      icon: Home
    },
    { 
      label: "Actualizaciones", 
      value: summary ? summary.properties_updated_today.toLocaleString() : "0", 
      icon: RefreshCw
    },
    { 
      label: "Total Inventario", 
      value: summary ? summary.properties_total.toLocaleString() : "0", 
      icon: TrendingUp
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario de Propiedades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {inventoryData.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={index} className="flex items-center p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold">{item.value}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}