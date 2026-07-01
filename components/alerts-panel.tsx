"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import type { Alert } from "@/lib/api"

interface AlertsPanelProps {
  alerts: Alert[]
}

const alertConfig = {
  critical: {
    icon: AlertTriangle,
    color: "bg-destructive/10 border-destructive/30",
    badgeColor: "bg-destructive text-white hover:bg-destructive",
    iconColor: "text-destructive",
  },
  warning: {
    icon: AlertCircle,
    color: "bg-brand-orange/10 border-brand-orange/30",
    badgeColor: "bg-brand-orange text-white hover:bg-brand-orange",
    iconColor: "text-brand-orange",
  },
  info: {
    icon: Info,
    color: "bg-accent border-info/30",
    badgeColor: "bg-info text-white hover:bg-info",
    iconColor: "text-info",
  },
}

function getTimeAgo(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes} min`
  } catch {
    return "N/A"
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

// Mostramos todas las alertas, pero las CRITICAL solo si tienen ≤ 24h
// (las críticas no cambian seguido y las antiguas quedan colgadas sin aportar).
function shouldShowAlert(alert: Alert): boolean {
  if (alert.level?.toLowerCase() !== "critical") return true
  const time = new Date(alert.timestamp).getTime()
  if (isNaN(time)) return false
  const age = Date.now() - time
  return age >= 0 && age <= DAY_MS
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const visibleAlerts = alerts.filter(shouldShowAlert)

  return (
    <Card>
        <CardHeader>
          <CardTitle>Alertas del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {visibleAlerts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No hay alertas activas
              </div>
            ) : (
              visibleAlerts.slice(0, 5).map((alert, index) => {
                const config = alertConfig[alert.level as keyof typeof alertConfig] || alertConfig.info
                const Icon = config.icon

                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div className={`p-3 rounded-lg border ${config.color} cursor-help`}>
                        <div className="flex items-start gap-3">
                          <Icon className={`h-4 w-4 mt-1 ${config.iconColor}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    <Badge className={config.badgeColor}>
                                      {alert.level.toUpperCase()}
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Nivel de alerta: {alert.level}</p>
                                </TooltipContent>
                              </Tooltip>
                              <span className="text-xs text-muted-foreground">
                                {alert.city} • hace {getTimeAgo(alert.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm">{alert.message}</p>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Alerta de nivel {alert.level} desde {alert.city}</p>
                      <p className="text-xs text-muted-foreground mt-1">Timestamp: {new Date(alert.timestamp).toLocaleString()}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
  )
}