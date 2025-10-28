import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, AlertCircle, Info } from "lucide-react"

const alerts = [
  {
    level: "critical",
    message: "Scraper de Cali detenido por error de conexión",
    time: "5 min",
  },
  {
    level: "warning",
    message: "Velocidad de Bogotá por debajo del promedio",
    time: "12 min",
  },
  {
    level: "info",
    message: "Medellín completó ejecución exitosamente",
    time: "15 min",
  },
  {
    level: "warning",
    message: "Próxima ejecución de Barranquilla en 30 minutos",
    time: "30 min",
  },
]

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

export function AlertsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas del Sistema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, index) => {
            const config = alertConfig[alert.level as keyof typeof alertConfig]
            const Icon = config.icon

            return (
              <div key={index} className={`p-3 rounded-lg border ${config.color}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                    <span className="text-xs text-muted-foreground mt-1 block">Hace {alert.time}</span>
                  </div>
                  <Badge className={`${config.badgeColor} flex-shrink-0`}>{alert.level}</Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
