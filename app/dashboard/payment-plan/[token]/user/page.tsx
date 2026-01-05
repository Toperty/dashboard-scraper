"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, RefreshCw, Home, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const MONTHS_PER_PAGE = 12

export default function UserDashboardPage() {
  const params = useParams()
  const token = params.token as string

  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cashFlowPage, setCashFlowPage] = useState(0)

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/dashboard/${token}/user`)
      
      if (response.status === 404) {
        setError('Dashboard no encontrado o el enlace ha expirado.')
        return
      }
      
      if (response.status === 410) {
        setError('Este dashboard ha expirado. Los dashboards tienen una duración de 10 días.')
        return
      }
      
      if (!response.ok) {
        throw new Error('Error al cargar el dashboard')
      }
      
      const data = await response.json()
      setDashboardData(data.dashboard)
      setError(null)
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      setError('Error al cargar el dashboard. Por favor, intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatCurrency = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return '-'
    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.,]/g, '').replace(/,/g, ''))
    if (isNaN(numValue)) return String(value)
    // Formato completo con separador de miles
    return `$${Math.round(numValue).toLocaleString('es-CO')}`
  }

  const userMetrics = [
    {
      title: 'Valor de la Propiedad',
      value: formatCurrency(dashboardData.data?.flujo_interno?.commercial_value),
      icon: Home,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Tu Cuota Inicial',
      value: formatCurrency(dashboardData.data?.flujo_interno?.user_down_payment),
      icon: User,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Meses en Programa',
      value: dashboardData.data?.flujo_interno?.program_months || '0',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  // Obtener la participación actual (mes 0 = inicio del programa)
  const participacionArray = dashboardData.data?.user_cash_flow?.participacion_adquirida || []
  // Mes 0 es el primer elemento del array
  const currentParticipacion = participacionArray[0] || 0
  // Convertir a porcentaje (el valor viene como decimal 0.XX)
  const participacionPorcentaje = currentParticipacion * 100

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Tu Plan de Pagos</h1>
              <p className="text-gray-600">{dashboardData.data?.para_usuario?.client_name}</p>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <Clock className="w-4 h-4" />
                <span>Válido por {dashboardData.days_remaining} días</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Welcome message */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">¡Felicidades por tu decisión!</h2>
                <p className="text-gray-600">
                  Has iniciado el camino hacia la propiedad de tu hogar. Aquí tienes un resumen de tu plan de pagos.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Program Information - Datos C2-C6 */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Programa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Valor de Lanzamiento</span>
                  <p className="font-medium">{dashboardData.data?.flujo_interno?.valor_lanzamiento || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tipo de Programa</span>
                  <p className="font-medium">{dashboardData.data?.flujo_interno?.tipo_programa || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tipo de Vivienda</span>
                  <p className="font-medium">{dashboardData.data?.flujo_interno?.tipo_vivienda || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Con Alistamiento</span>
                  <p className="font-medium">{dashboardData.data?.flujo_interno?.con_alistamiento === 'Si' ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Financiación Gastos Cierre</span>
                  <p className="font-medium">{dashboardData.data?.flujo_interno?.con_financiacion_gastos === 'Si' ? 'Sí' : 'No'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {userMetrics.map((metric, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">{metric.title}</p>
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </div>
                    <div className={`${metric.bgColor} p-3 rounded-lg`}>
                      <metric.icon className={`w-6 h-6 ${metric.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Progress to homeownership */}
          <Card>
            <CardHeader>
              <CardTitle>Tu Progreso hacia la Casa Propia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-green-600">
                    {participacionPorcentaje.toFixed(2)}%
                  </span>
                  <span className="text-sm text-gray-500">
                    de participación adquirida
                  </span>
                </div>
                <Progress value={participacionPorcentaje} className="h-4" />
                <p className="text-sm text-gray-600">
                  Este porcentaje representa tu participación actual en la propiedad. Al completar el programa, podrás acceder a financiación hipotecaria.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Property details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles de tu Futura Propiedad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">Área</span>
                    <p className="font-medium text-lg">{dashboardData.data?.para_usuario?.area || '-'} m²</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Valor Comercial</span>
                    <p className="font-medium text-lg">{formatCurrency(dashboardData.data?.para_usuario?.commercial_value)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">Valor de Lanzamiento Toperty</span>
                    <p className="font-medium text-lg">{formatCurrency(dashboardData.data?.para_usuario?.valor_lanzamiento)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Costo Financiero Toperty por m²</span>
                    <p className="font-medium text-lg">{formatCurrency(dashboardData.data?.para_usuario?.costo_financiero_m2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Projection - User View */}
          {dashboardData.data?.user_cash_flow?.mes_numero?.length > 0 && (() => {
            const cashFlow = dashboardData.data.user_cash_flow
            const programMonths = dashboardData.data?.flujo_interno?.program_months || 60
            const totalCols = programMonths + 2 // mes 0 + programa + 1 final
            const allDates = (cashFlow.fecha || []).slice(0, totalCols)
            const allMonths = (cashFlow.mes_numero || []).slice(0, totalCols)
            // Usar fecha si existe, sino usar mes_numero formateado
            const headers = allDates.length > 0 && allDates[0] ? allDates : allMonths.map((m: number) => `M${m}`)
            const totalMonths = totalCols
            const totalPages = Math.ceil(totalMonths / MONTHS_PER_PAGE)
            const startIdx = cashFlowPage * MONTHS_PER_PAGE
            const endIdx = Math.min(startIdx + MONTHS_PER_PAGE, totalMonths)
            const visibleHeaders = headers.slice(startIdx, endIdx)
            const visibleCount = visibleHeaders.length

            const getSlice = (arr: any[]) => arr ? arr.slice(startIdx, endIdx) : []

            // Para cuota inicial M0, usar user_down_payment si el array no tiene valor
            const getCuotaInicialValue = (value: number | null, index: number) => {
              const actualMonth = allMonths[startIdx + index]
              if (actualMonth === 0 && !value) {
                return dashboardData.data?.flujo_interno?.user_down_payment
              }
              return value
            }

            return (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Tu Proyección de Pagos</CardTitle>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCashFlowPage(p => Math.max(0, p - 1))} disabled={cashFlowPage === 0} className="h-7 px-2">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-gray-600">{cashFlowPage + 1}/{totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCashFlowPage(p => Math.min(totalPages - 1, p + 1))} disabled={cashFlowPage >= totalPages - 1} className="h-7 px-2">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-2 md:p-4 pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse table-fixed">
                      <thead>
                        <tr className="border-b bg-gray-100">
                          <th className="px-2 py-1 text-left font-medium text-gray-700 sticky left-0 z-10 bg-gray-100 w-44">Concepto</th>
                          {visibleHeaders.map((header: string, index: number) => (
                            <th key={index} className={`px-1 py-1 text-right font-medium text-gray-700 whitespace-nowrap w-[85px] ${allMonths[startIdx + index] <= 1 ? 'bg-blue-50' : ''}`}>{header || '-'}</th>
                          ))}
                          <th className="bg-gray-100"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-green-50 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-green-800">Ingresos</td></tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(+) Cuota Inicial</td>
                          {getSlice(cashFlow.cuota_inicial_usuario).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-green-600 whitespace-nowrap`}>
                              {getCuotaInicialValue(value, i) ? formatCurrency(getCuotaInicialValue(value, i)) : '-'}
                            </td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(+) Renta</td>
                          {getSlice(cashFlow.renta).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-green-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(+) Compra Parcial</td>
                          {getSlice(cashFlow.compra_parcial).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-green-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="bg-orange-50 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-orange-800">Gastos a tu Cargo</td></tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Impuesto Predial</td>
                          {getSlice(cashFlow.impuesto_predial).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Administración</td>
                          {getSlice(cashFlow.administracion).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Seguro Todo Riesgo</td>
                          {getSlice(cashFlow.seguro_todo_riesgo).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Reparaciones</td>
                          {getSlice(cashFlow.reparaciones_estimadas).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="bg-blue-50 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-blue-800">Tu Participación</td></tr>
                        <tr className="border-b hover:bg-gray-50 bg-blue-50/30">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white font-medium">(=) Total Participación</td>
                          {getSlice(cashFlow.participacion_adquirida).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-blue-700 font-semibold whitespace-nowrap`}>{value ? `${(value * 100).toFixed(2)}%` : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Next steps */}
          <Card>
            <CardHeader>
              <CardTitle>Próximos Pasos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <h3 className="font-semibold">Mantén tu ahorro constante</h3>
                    <p className="text-gray-600">Realiza tus pagos mensuales puntualmente durante {dashboardData.data?.flujo_interno?.program_months || 'el'} mes{parseInt(dashboardData.data?.flujo_interno?.program_months || '0') > 1 ? 'es' : ''} del programa.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <h3 className="font-semibold">Prepara tu documentación</h3>
                    <p className="text-gray-600">Reúne los documentos necesarios para el proceso hipotecario.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <h3 className="font-semibold">¡Obtén las llaves!</h3>
                    <p className="text-gray-600">Al completar el programa, estarás listo para solicitar tu crédito hipotecario y mudarte a tu nuevo hogar.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}