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
    color: "bg-red-50 border-red-200",
    badgeColor: "bg-red-600 text-white hover:bg-red-600",
    iconColor: "text-red-600",
  },
  warning: {
    icon: AlertCircle,
    color: "bg-yellow-50 border-yellow-200",
    badgeColor: "bg-yellow-600 text-white hover:bg-yellow-600",
    iconColor: "text-yellow-600",
  },
  info: {
    icon: Info,
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-600 text-white hover:bg-blue-600",
    iconColor: "text-blue-600",
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

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card>
        <CardHeader>
          <CardTitle>Alertas del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No hay alertas activas
              </div>
            ) : (
              alerts.slice(0, 5).map((alert, index) => {
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