import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react"

const cityData = [
  {
    city: "Bogotá",
    status: "running",
    sellProgress: 65,
    sellPages: "13/20",
    rentProgress: 80,
    rentPages: "16/20",
    lastUpdate: "2 min",
  },
  {
    city: "Medellín",
    status: "completed",
    sellProgress: 100,
    sellPages: "15/15",
    rentProgress: 100,
    rentPages: "12/12",
    lastUpdate: "15 min",
  },
  {
    city: "Cali",
    status: "error",
    sellProgress: 45,
    sellPages: "9/20",
    rentProgress: 0,
    rentPages: "0/18",
    lastUpdate: "5 min",
  },
  {
    city: "Barranquilla",
    status: "scheduled",
    sellProgress: 0,
    sellPages: "0/12",
    rentProgress: 0,
    rentPages: "0/10",
    lastUpdate: "1 hora",
  },
]

const statusConfig = {
  running: { label: "En Ejecución", icon: Clock, color: "bg-blue-500 text-white hover:bg-blue-500" },
  completed: { label: "Completado", icon: CheckCircle2, color: "bg-green-600 text-white hover:bg-green-600" },
  error: { label: "Error", icon: XCircle, color: "bg-red-600 text-white hover:bg-red-600" },
  scheduled: { label: "Programado", icon: AlertCircle, color: "bg-slate-500 text-white hover:bg-slate-500" },
}

export function CityStatusTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado por Ciudad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cityData.map((city, index) => {
            const status = statusConfig[city.status as keyof typeof statusConfig]
            const StatusIcon = status.icon

            return (
              <div key={index} className="p-4 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{city.city}</h3>
                    <Badge className={status.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">Actualizado hace {city.lastUpdate}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {/* Sell Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Venta</span>
                      <span className="text-sm font-mono text-muted-foreground">{city.sellPages}</span>
                    </div>
                    <Progress value={city.sellProgress} className="h-2" />
                    <span className="text-xs text-muted-foreground">{city.sellProgress}%</span>
                  </div>

                  {/* Rent Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Arriendo</span>
                      <span className="text-sm font-mono text-muted-foreground">{city.rentPages}</span>
                    </div>
                    <Progress value={city.rentProgress} className="h-2" />
                    <span className="text-xs text-muted-foreground">{city.rentProgress}%</span>
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
