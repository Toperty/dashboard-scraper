"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Building2, CheckCircle, TrendingUp } from "lucide-react"
import type { Summary } from "@/lib/api"

interface GeneralStatusProps {
  summary: Summary | null
}

export function GeneralStatus({ summary }: GeneralStatusProps) {
  const kpis = [
    { 
      label: "Ciudades Activas", 
      value: summary ? `${summary.active_cities}/${summary.total_cities}` : "0/0", 
      icon: Building2, 
      color: "text-green-600" 
    },
    { 
      label: "Completadas", 
      value: summary ? `${summary.completed_cities}` : "0", 
      icon: CheckCircle, 
      color: "text-blue-600" 
    },
    { 
      label: "Props Hoy", 
      value: summary ? summary.properties_today.toLocaleString() : "0", 
      icon: TrendingUp, 
      color: "text-purple-600" 
    },
    { 
      label: "Velocidad", 
      value: summary && summary.avg_speed_ms > 0 
        ? `${(summary.avg_speed_ms / 1000).toFixed(1)}s` 
        : "N/A", 
      icon: Activity, 
      color: "text-orange-600" 
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado General del Sistema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon
            return (
              <div key={index} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
              </div>
            )
          })}
        </div>
        {summary && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Total de propiedades en BD: {summary.properties_total.toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}