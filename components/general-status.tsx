import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Zap, Target, TrendingUp } from "lucide-react"

const kpis = [
  { label: "Tasa de Éxito", value: "94.2%", icon: Activity, color: "text-green-600" },
  { label: "Velocidad Promedio", value: "2.3 pág/min", icon: Zap, color: "text-blue-600" },
  { label: "Cobertura", value: "87.5%", icon: Target, color: "text-purple-600" },
  { label: "Eficiencia", value: "91.8%", icon: TrendingUp, color: "text-orange-600" },
]

export function GeneralStatus() {
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
      </CardContent>
    </Card>
  )
}
