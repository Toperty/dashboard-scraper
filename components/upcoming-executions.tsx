import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const upcomingExecutions = [
  { city: "Bogotá", type: "sell", time: "14:30", status: "scheduled" },
  { city: "Medellín", type: "rent", time: "15:00", status: "scheduled" },
  { city: "Cali", type: "sell", time: "15:30", status: "scheduled" },
  { city: "Barranquilla", type: "rent", time: "16:00", status: "scheduled" },
]

export function UpcomingExecutions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Próximas Ejecuciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingExecutions.map((execution, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{execution.city}</p>
                  <p className="text-xs text-muted-foreground">Tipo: {execution.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-medium">{execution.time}</span>
                <Badge variant="outline">Programado</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
