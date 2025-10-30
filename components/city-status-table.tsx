"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, AlertCircle, Clock, XCircle, MapPin } from "lucide-react"
import type { CityStatus } from "@/lib/api"

interface CityStatusTableProps {
  cities: CityStatus[]
}

const statusConfig = {
  completed: { label: "Completado", icon: CheckCircle2, color: "bg-green-600 text-white hover:bg-green-600" },
  en_proceso: { label: "En proceso", icon: Clock, color: "bg-orange-500 text-white hover:bg-orange-500" },
  programado: { label: "Programado", icon: Clock, color: "bg-blue-500 text-white hover:bg-blue-500" },
  atrasado: { label: "Atrasado", icon: XCircle, color: "bg-red-600 text-white hover:bg-red-600" },
  no_iniciado: { label: "No Iniciado", icon: AlertCircle, color: "bg-slate-500 text-white hover:bg-slate-500" },
}

function getTimeAgo(lastUpdate: string): string {
  try {
    const date = new Date(lastUpdate)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes} min`
  } catch {
    return "N/A"
  }
}

export function CityStatusTable({ cities }: CityStatusTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado por Ciudad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay datos de ciudades disponibles
            </div>
          ) : (
            cities.map((city) => {
              const status = statusConfig[city.status as keyof typeof statusConfig] || statusConfig.no_iniciado
              const StatusIcon = status.icon

              return (
                <div key={city.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold">{city.name}</h3>
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <Badge variant="outline">
                        {city.properties_today} props hoy
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Actualizado hace {getTimeAgo(city.last_update)}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {/* Sell Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Venta</span>
                        <span className="text-sm font-mono text-muted-foreground">{city.sell_pages}</span>
                      </div>
                      <Progress value={city.sell_progress} className="h-2" />
                      <span className="text-xs text-muted-foreground">{city.sell_progress.toFixed(1)}%</span>
                    </div>

                    {/* Rent Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Arriendo</span>
                        <span className="text-sm font-mono text-muted-foreground">{city.rent_pages}</span>
                      </div>
                      <Progress value={city.rent_progress} className="h-2" />
                      <span className="text-xs text-muted-foreground">{city.rent_progress.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}