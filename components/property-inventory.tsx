"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
      icon: Home,
      tooltip: "Propiedades descubiertas y añadidas a la base de datos en las últimas 24 horas"
    },
    { 
      label: "Propiedades Actualizadas Hoy", 
      value: summary ? summary.properties_updated_today.toLocaleString() : "0", 
      icon: RefreshCw,
      tooltip: "Propiedades existentes que han sido actualizadas con nueva información hoy"
    },
    { 
      label: "Total Inventario", 
      value: summary ? summary.properties_total.toLocaleString() : "0", 
      icon: TrendingUp,
      tooltip: "Número total de propiedades únicas almacenadas en la base de datos"
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
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center p-4 rounded-lg border bg-card cursor-help">
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
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </CardContent>
      </Card>
  )
}