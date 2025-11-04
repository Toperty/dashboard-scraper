"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { NextExecution } from "@/lib/api"

interface UpcomingExecutionsProps {
  executions: NextExecution[]
}

function formatTime(scheduled_time: string): string {
  try {
    const date = new Date(scheduled_time)
    return date.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  } catch {
    return "N/A"
  }
}

export function UpcomingExecutions({ executions }: UpcomingExecutionsProps) {
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
            {executions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No hay ejecuciones programadas
              </div>
            ) : (
              executions.slice(0, 5).map((execution, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 cursor-help">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{execution.city}</p>
                          <p className="text-xs text-muted-foreground">
                            Tipo: {execution.type === 'sell' ? 'Ventas' : 'Arriendos'}
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Próxima ejecución programada para {execution.city} - {execution.type === 'sell' ? 'Ventas' : 'Arriendos'}</p>
                      <p className="text-xs text-muted-foreground mt-1">Programada para las {formatTime(execution.scheduled_time)}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatTime(execution.scheduled_time)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <Badge variant="outline">
                            {execution.minutes_remaining} min
                          </Badge>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tiempo restante: {execution.minutes_remaining} minutos</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
  )
}