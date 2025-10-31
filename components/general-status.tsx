"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle, Clock, AlertTriangle, Zap } from "lucide-react"
import type { Summary } from "@/lib/api"

interface GeneralStatusProps {
  summary: Summary | null
}

export function GeneralStatus({ summary }: GeneralStatusProps) {
  const kpis = [
    { 
      label: "Ciudades Completadas", 
      value: summary ? `${summary.completed_cities}/${summary.total_cities}` : "0/0", 
      icon: CheckCircle, 
      color: "text-green-600",
      tooltip: "Número de ciudades que han completado su proceso de scraping del total de ciudades configuradas"
    },
    { 
      label: "Última Ejecución", 
      value: summary?.last_execution_time || "N/A", 
      icon: Clock, 
      color: "text-blue-600",
      tooltip: "Tiempo transcurrido desde la última actividad registrada en el sistema de scraping"
    },
    { 
      label: "Errores Recientes", 
      value: summary?.recent_errors_count|| "0", 
      icon: AlertTriangle, 
      color: "text-red-600",
      tooltip: "Número de errores ocurridos en las últimas 24 horas durante el proceso de scraping"
    },
    { 
      label: "Páginas por Minuto", 
      value: summary && summary.avg_speed_ms > 0 
        ? summary.avg_speed_ms.toFixed(2)
        : "N/A", 
      icon: Zap, 
      color: "text-orange-600",
      tooltip: "Velocidad promedio de navegación del scraper calculada en páginas procesadas por minuto"
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
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div className="p-4 rounded-lg border bg-card cursor-help">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-4 w-4 ${kpi.color}`} />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                      </div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{kpi.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          {summary && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-4 pt-4 border-t cursor-help">
                  <div className="text-sm text-muted-foreground">
                    Total de propiedades en BD: {summary.properties_total.toLocaleString()}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Número total de propiedades almacenadas en la base de datos desde el inicio del sistema</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardContent>
      </Card>
  )
}