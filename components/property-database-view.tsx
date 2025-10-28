import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database } from "lucide-react"

export function PropertyDatabaseView() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Base de Datos de Propiedades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Database className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Vista de Base de Datos</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Esta sección mostrará el listado completo de propiedades almacenadas en la base de datos con opciones de
            filtrado y búsqueda.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
