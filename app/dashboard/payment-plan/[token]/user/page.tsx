"use client"

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, RefreshCw, Home, User, ChevronLeft, ChevronRight, CheckCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { TopertyLogo } from '@/components/toperty-logo'

const MONTHS_PER_PAGE = 12

export default function UserDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string

  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cashFlowPage, setCashFlowPage] = useState(0)
  const [expandedSteps, setExpandedSteps] = useState<number[]>([])
  const [disclaimerExpanded, setDisclaimerExpanded] = useState(false)

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
          <div className="flex justify-between items-start">
            {/* Logo y título */}
            <div className="flex items-center gap-4">
              <TopertyLogo width={100} height={40} />
              <div>
                <h1 className="text-2xl font-bold">Tu Plan de Pagos</h1>
                <p className="text-gray-600">{dashboardData.data?.para_usuario?.client_name}</p>
              </div>
            </div>
            
            {/* Status e indicadores */}
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <Clock className="w-4 h-4" />
                <span>Válido por {dashboardData.days_remaining} días</span>
              </div>
              {/* Indicador de estado del plan */}
              {dashboardData.data?.plan_status && (
                <div className={`flex items-center gap-2 text-sm mt-1 ${dashboardData.data.plan_status.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {dashboardData.data.plan_status.valid ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>{dashboardData.data.plan_status.message}</span>
                </div>
              )}
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
                  <div>
                    <span className="text-2xl font-bold text-green-600">
                      {participacionPorcentaje.toFixed(2)}%
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      de {((dashboardData.data?.flujo_interno?.potential_down_payment || 0.20) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Objetivo de adquisición
                  </span>
                </div>
                <Progress 
                  value={(participacionPorcentaje / ((dashboardData.data?.flujo_interno?.potential_down_payment || 0.20) * 100)) * 100} 
                  className="h-4" 
                />
                <div className="text-sm text-gray-600">
                  <p>
                    Este porcentaje representa tu participación actual en la propiedad. 
                  </p>
                  <p className="mt-1">
                    <strong>Meta:</strong> Al alcanzar el {((dashboardData.data?.flujo_interno?.potential_down_payment || 0.20) * 100).toFixed(0)}% podrás acceder a financiación hipotecaria.
                  </p>
                </div>
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

          {/* Gráficas de Análisis */}
          {dashboardData.data?.graficas && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Primera gráfica: Barras apiladas + línea */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución de Inversión</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.data.graficas.grafica1 && (() => {
                      const data = dashboardData.data.graficas.grafica1.headers.map((header: string, index: number) => ({
                        name: header,
                        [dashboardData.data.graficas.grafica1.label1 || 'Serie 1']: dashboardData.data.graficas.grafica1.serie1[index] || 0,
                        [dashboardData.data.graficas.grafica1.label2 || 'Serie 2']: dashboardData.data.graficas.grafica1.serie2[index] || 0,
                        [dashboardData.data.graficas.grafica1.label3 || 'Serie 3']: dashboardData.data.graficas.grafica1.serie3[index] || 0,
                      }))

                      return (
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis 
                              tickFormatter={(value) => {
                                if (value >= 1000000) {
                                  return `${(value / 1000000).toFixed(0)}M`
                                } else if (value >= 1000) {
                                  return `${(value / 1000).toFixed(0)}K`
                                }
                                return value.toString()
                              }}
                              width={30}
                            />
                            <Tooltip formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value} />
                            <Legend />
                            <Bar dataKey={dashboardData.data.graficas.grafica1.label1 || 'Serie 1'} stackId="a" fill="#021945" />
                            <Bar dataKey={dashboardData.data.graficas.grafica1.label2 || 'Serie 2'} stackId="a" fill="#6efafb" />
                            <Line type="monotone" dataKey={dashboardData.data.graficas.grafica1.label3 || 'Serie 3'} stroke="#0466c9" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </CardContent>
                </Card>

                {/* Segunda gráfica: Barras comparativas + línea */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparación de Flujos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.data.graficas.grafica2 && (() => {
                      const data = dashboardData.data.graficas.grafica2.headers.map((header: string, index: number) => ({
                        name: header,
                        [dashboardData.data.graficas.grafica2.label1 || 'Serie 1']: dashboardData.data.graficas.grafica2.serie1[index] || 0,
                        [dashboardData.data.graficas.grafica2.label2 || 'Serie 2']: dashboardData.data.graficas.grafica2.serie2[index] || 0,
                        [dashboardData.data.graficas.grafica2.label3 || 'Serie 3']: dashboardData.data.graficas.grafica2.serie3[index] || 0,
                      }))

                      return (
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis 
                              tickFormatter={(value) => {
                                if (value >= 1000000) {
                                  return `${(value / 1000000).toFixed(0)}M`
                                } else if (value >= 1000) {
                                  return `${(value / 1000).toFixed(0)}K`
                                }
                                return value.toString()
                              }}
                              width={30}
                            />
                            <Tooltip formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value} />
                            <Legend />
                            <Bar dataKey={dashboardData.data.graficas.grafica2.label1 || 'Serie 1'} fill="#021945" />
                            <Bar dataKey={dashboardData.data.graficas.grafica2.label2 || 'Serie 2'} fill="#6efafb" />
                            <Line type="monotone" dataKey={dashboardData.data.graficas.grafica2.label3 || 'Serie 3'} stroke="#0466c9" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Tabla Comparativa */}
              {dashboardData.data.graficas.tabla_comparativa && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Análisis Comparativo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            {dashboardData.data.graficas.tabla_comparativa.headers.filter((header: string, index: number) => index % 2 === 0).map((header: string, index: number) => (
                              <th key={index} className={`px-2 py-3 ${index === 0 ? 'text-left' : 'text-center'} font-medium text-gray-700 ${index === 0 ? 'sticky left-0 z-10 bg-gray-50' : ''}`}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.data.graficas.tabla_comparativa.data.map((row: any[], rowIndex: number) => (
                            <tr key={rowIndex} className="border-b hover:bg-gray-50">
                              {row.filter((cell: any, cellIndex: number) => cellIndex % 2 === 0).map((filteredCell: any, newIndex: number) => {
                                // Obtener el nombre de la fila (primera celda filtrada)
                                const rowName = row.filter((cell: any, cellIndex: number) => cellIndex % 2 === 0)[0]?.toString().toLowerCase() || '';
                                
                                let displayValue = filteredCell || '';
                                
                                if (typeof filteredCell === 'number') {
                                  // Si es la fila de tasas o cuotas mensuales/VC y el valor es decimal, formatear como porcentaje
                                  if ((rowName.includes('tasa') || rowName.includes('cuota mensual / vc')) && filteredCell < 1 && filteredCell > 0) {
                                    displayValue = (filteredCell * 100).toFixed(2) + '%';
                                  } else {
                                    displayValue = formatCurrency(filteredCell);
                                  }
                                }
                                
                                return (
                                  <td key={newIndex} className={`px-2 py-3 ${newIndex === 0 ? 'sticky left-0 z-10 bg-white font-medium' : ''} ${typeof filteredCell === 'number' ? 'text-right' : ''}`}>
                                    {displayValue}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

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
                        <tr className="bg-green-50 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-green-800">Pagos Rent to Own</td></tr>
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
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white font-medium">Total Pagos Rent to Own</td>
                          {getSlice(cashFlow.total_pagos_rent_to_own).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-green-600 font-semibold whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
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
              <div className="space-y-2">
                {[
                  {
                    title: "Aprueba tu plan de pagos",
                    content: "Revisa detalladamente este plan de pagos y asegúrate de entender las cuotas mensuales, la duración del programa y la evolución del valor comercial del inmueble. Si estás de acuerdo con las condiciones, confírmale tu aprobación al asesor de Toperty que ha liderado tu proceso."
                  },
                  {
                    title: "Firma tu plan de pagos",
                    content: "Una vez confirmes la aprobación, te enviaremos un documento con la información del plan de pagos para que lo firmes digitalmente. Este documento formaliza tu aceptación de las condiciones del programa."
                  },
                  {
                    title: "Pago del fee de entrada",
                    content: "Para que Toperty pueda iniciar la negociación formal con el propietario actual del inmueble, deberás realizar el pago del fee de entrada. Este pago nos permite proceder con la visita técnica al inmueble y la debida diligencia legal."
                  },
                  {
                    title: "Firma de promesa de compraventa con el propietario",
                    content: "Toperty firmará la promesa de compraventa con el propietario actual del inmueble. En este momento, deberás aportar la cuota inicial acordada en tu plan de pagos."
                  },
                  {
                    title: "Firma de promesa de compraventa contigo",
                    content: "Firmaremos la promesa de compraventa entre Toperty y tú, donde quedarán establecidas las condiciones del programa Rent to Own, incluyendo el valor de compra futuro y los términos de tu participación."
                  },
                  {
                    title: "Escrituración y desembolso",
                    content: "Toperty procederá con la escrituración y desembolso para adquirir el inmueble. Una vez completado este proceso, el inmueble quedará a nombre de Toperty (o del vehículo constituido para tal fin)."
                  },
                  {
                    title: "Entrega del inmueble y firma del contrato de arriendo",
                    content: "Recibirás las llaves de tu nueva vivienda y firmaremos el contrato de arrendamiento. Los pagos mensuales inician desde la fecha de entrega del inmueble. Si la entrega se realiza a mitad de mes, la cuota de ese primer mes se calculará de forma proporcional."
                  },
                  {
                    title: "Pagos mensuales",
                    content: "Cada mes pagarás el canon de arrendamiento más el componente de compra parcial, además de los gastos operativos a tu cargo (administración, predial, seguro y mantenimiento)."
                  },
                  {
                    title: "Monitorea tu progreso",
                    content: "Accede a tu dashboard personalizado para consultar tu porcentaje de participación, tiempo transcurrido y valor actualizado del inmueble."
                  },
                  {
                    title: "Gestión de crédito",
                    content: "Antes de alcanzar tu porcentaje objetivo, te ayudaremos a gestionar tu crédito de vivienda o leasing habitacional."
                  },
                  {
                    title: "Transferencia final",
                    content: "Una vez aprobado tu crédito, realizaremos la transferencia del inmueble a tu nombre. ¡Serás oficialmente propietario!"
                  }
                ].map((step, index) => (
                  <div key={index} className="border rounded-lg">
                    <button
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        if (expandedSteps.includes(index)) {
                          setExpandedSteps(expandedSteps.filter(i => i !== index))
                        } else {
                          setExpandedSteps([...expandedSteps, index])
                        }
                      }}
                    >
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold">
                          {index < 7 ? `Paso ${index + 1} - ` : index >= 7 ? 'Durante el programa: ' : ''}
                          {step.title}
                        </h3>
                      </div>
                      <div className="flex-shrink-0">
                        {expandedSteps.includes(index) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>
                    {expandedSteps.includes(index) && (
                      <div className="px-4 pb-3 pl-13">
                        <p className="text-gray-600">{step.content}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Descargo de Responsabilidad */}
          <Card>
            <CardHeader>
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setDisclaimerExpanded(!disclaimerExpanded)}
              >
                <CardTitle>Descargo de Responsabilidad</CardTitle>
                {disclaimerExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </CardHeader>
            {disclaimerExpanded && (
              <CardContent>
                <div className="space-y-4 text-sm text-gray-600">
                  <p>
                    Toperty S.A.S. (en adelante "Toperty") pone a disposición el presente plan de pagos, el cual está sujeto a la negociación de Toperty con el actual propietario del inmueble. La obligación de Toperty con respecto a la adquisición del inmueble es de medio y no de resultado.
                  </p>
                  
                  <div>
                    Naturaleza proyectiva del plan: El presente plan de pagos es una proyección elaborada con supuestos macroeconómicos para propósitos ilustrativos únicamente, y no constituye el plan de pagos final. Las cuotas mensuales están sujetas a incrementos anuales de acuerdo al Índice de Precios al Consumidor (IPC) certificado por el DANE, y el valor comercial del inmueble se actualizará en función de (i) la inflación certificada por el DANE o la tasa de incremento fija anual del 5,5% (la que sea mayor); y (ii) el tiempo que el usuario tarde en adquirir el porcentaje objetivo de participación. Por lo tanto, las cifras aquí presentadas podrán variar por factores externos que Toperty no controla, incluyendo la evolución de la inflación en Colombia y los aportes extraordinarios del usuario a modo de prepago, entre otros.
                  </div>
                  
                  <div>
                    Gastos adicionales a cargo del usuario: Los gastos asociados a la propiedad del inmueble tales como impuestos prediales, seguro todo riesgo, cuotas de administración (ordinarias y extraordinarias), reparaciones y mantenimiento general, entre otros, serán pagados por el usuario de conformidad con los contratos del modelo de negocio acordado. Toperty se encargará únicamente del pago del seguro de arrendamiento.
                  </div>
                  
                  <div>
                    Objetivo del programa: El presente plan de pagos está estructurado para que el usuario compre la vivienda al finalizar el programa con el porcentaje de participación indicado en este documento. Dependiendo del tipo de financiación que el usuario elija al finalizar el programa (leasing habitacional o crédito hipotecario), el porcentaje objetivo de adquisición y las condiciones del plan podrán ajustarse.
                  </div>
                  
                  <div>
                    Valoración del inmueble: El presente plan de pagos está estructurado de acuerdo a las características del inmueble que el usuario seleccionó mediante el formato suministrado por Toperty en https://avaluo.toperty.co/. De haber alguna inconsistencia en la información suministrada, el plan de pagos podrá variar.
                  </div>
                  
                  <p>
                    Este documento no representa una oferta vinculante para Toperty S.A.S., la cual está sujeta únicamente a que se completen todos los pasos del proceso. Toperty S.A.S. se reserva el derecho a dar por terminado el proceso en cualquier momento y bajo su absoluta discreción.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}