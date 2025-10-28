import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, TrendingUp, RefreshCw } from "lucide-react"

const inventoryData = [
  { label: "Propiedades Nuevas", value: "1,247", icon: Home, change: "+12%" },
  { label: "Actualizaciones", value: "3,891", icon: RefreshCw, change: "+8%" },
  { label: "Total Inventario", value: "45,623", icon: TrendingUp, change: "+5%" },
]

export function PropertyInventory() {
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
              <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold">{item.value}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-green-600">{item.change}</span>
                  <p className="text-xs text-muted-foreground">vs. anterior</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
