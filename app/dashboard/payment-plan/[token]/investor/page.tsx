"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, RefreshCw, TrendingUp, DollarSign, BarChart3, PieChart, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TopertyLogo } from '@/components/toperty-logo'

const MONTHS_PER_PAGE = 12

export default function InvestorDashboardPage() {
  const params = useParams()
  const token = params.token as string

  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cashFlowPage, setCashFlowPage] = useState(0)

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/dashboard/${token}/investor`)
      
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

  const formatPercent = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return '0%'
    const strValue = String(value)
    if (strValue.includes('%')) return strValue
    const numValue = typeof value === 'number' ? value : parseFloat(strValue)
    if (isNaN(numValue)) return strValue
    // If value is less than 1, assume it's a decimal (e.g., 0.2 = 20%)
    const percentValue = numValue < 1 ? numValue * 100 : numValue
    return `${percentValue.toFixed(1)}%`
  }

  const formatPercent2Decimals = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return 'N/A'
    const strValue = String(value)
    if (strValue.includes('%')) {
      // Si ya viene con %, extraer el número y reformatearlo
      const numValue = parseFloat(strValue.replace('%', ''))
      if (isNaN(numValue)) return strValue
      return `${numValue.toFixed(2)}%`
    }
    const numValue = typeof value === 'number' ? value : parseFloat(strValue)
    if (isNaN(numValue)) return strValue
    // If value is less than 1, assume it's a decimal (e.g., 0.2 = 20%)
    const percentValue = numValue < 1 ? numValue * 100 : numValue
    return `${percentValue.toFixed(2)}%`
  }

  const formatNumber2Decimals = (value: string | number | undefined): string => {
    if (value === undefined || value === null || value === '') return 'N/A'
    const strValue = String(value)
    const numValue = typeof value === 'number' ? value : parseFloat(strValue.replace(/[^\d.,]/g, '').replace(/,/g, ''))
    if (isNaN(numValue)) return strValue
    return numValue.toFixed(2)
  }

  const investorMetrics = [
    {
      title: 'Valor Comercial',
      value: formatCurrency(dashboardData.data?.flujo_interno?.commercial_value),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Valor actual de la propiedad'
    },
    {
      title: 'Precio de Venta',
      value: formatCurrency(dashboardData.data?.flujo_interno?.asking_price),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Precio objetivo de venta'
    },
    {
      title: 'Total Inversión por Unidad',
      value: formatCurrency(dashboardData.data?.flujo_interno?.inversion_por_unidad),
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Inversión requerida por unidad'
    },
    {
      title: 'Valor a Financiar al Cliente',
      value: formatCurrency(dashboardData.data?.flujo_interno?.valor_a_financiar),
      icon: PieChart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Monto a financiar'
    }
  ]


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
                <h1 className="text-2xl font-bold">Dashboard de Inversión</h1>
                <p className="text-gray-600">Análisis financiero - {dashboardData.valuation_name}</p>
              </div>
            </div>
            
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

          {/* Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {investorMetrics.map((metric, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`${metric.bgColor} p-2 rounded-lg`}>
                      <metric.icon className={`w-5 h-5 ${metric.color}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{metric.title}</p>
                    <p className="text-2xl font-bold mb-1">{metric.value}</p>
                    <p className="text-xs text-gray-500">{metric.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Property Information - Full Width */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div>
                  <span className="text-sm text-gray-500 text-center block">Inmueble</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.edificio_nombre || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Área Construida</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.area_construida || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Año de Construcción</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.ano_construccion || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Habitaciones</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.habitaciones || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Administración Mensual</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.cuota_administracion ? formatCurrency(dashboardData.data.resumen.cuota_administracion) : 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Parqueadero</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.parqueadero || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-500">Ascensor</span>
                  <p className="font-medium">{dashboardData.data?.resumen?.ascensor || 'N/A'}</p>
                </div>
                {dashboardData.data?.resumen?.amenities && (
                  <div>
                    <span className="text-sm text-gray-500 text-center block">Amenidades</span>
                    <p className="font-medium">{dashboardData.data.resumen.amenities}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Investment Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Commercial Valuation */}
            <Card>
              <CardHeader>
                <CardTitle>Avalúo Comercial y Valor de Compra</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Valor Comercial - Avalúo Toperty</span>
                      <span className="font-semibold text-green-600">{dashboardData.data?.resumen?.valor_comercial_toperty ? formatCurrency(dashboardData.data.resumen.valor_comercial_toperty) : 'N/A'}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {dashboardData.data?.resumen?.valor_comercial_toperty_m2 ? 
                        `${formatCurrency(dashboardData.data.resumen.valor_comercial_toperty_m2)} por m²` : 
                        'N/A por m²'}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Valor de Compra</span>
                      <span className="font-semibold">{dashboardData.data?.resumen?.valor_compra ? formatCurrency(dashboardData.data.resumen.valor_compra) : 'N/A'}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {dashboardData.data?.resumen?.valor_compra_m2 ? 
                        `${formatCurrency(dashboardData.data.resumen.valor_compra_m2)} por m²` : 
                        'N/A por m²'}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Gastos de Cierre</span>
                      <span className="font-semibold">{dashboardData.data?.resumen?.gastos_cierre ? formatCurrency(dashboardData.data.resumen.gastos_cierre) : 'N/A'}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {dashboardData.data?.resumen?.gastos_cierre_m2 ? 
                        `${formatCurrency(dashboardData.data.resumen.gastos_cierre_m2)} por m²` : 
                        'N/A por m²'}
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-medium">Monto Total Inversión</span>
                      <span className="font-bold text-blue-600">{dashboardData.data?.resumen?.monto_total_inversion ? formatCurrency(dashboardData.data.resumen.monto_total_inversion) : 'N/A'}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {dashboardData.data?.resumen?.monto_total_inversion_m2 ? 
                        `${formatCurrency(dashboardData.data.resumen.monto_total_inversion_m2)} por m²` : 
                        'N/A por m²'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Information and Returns */}
            <Card>
              <CardHeader>
                <CardTitle>Información Usuario y Retornos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Canon de Arrendamiento</span>
                      <span className="font-semibold text-green-600">{dashboardData.data?.resumen?.canon_arrendamiento ? formatCurrency(dashboardData.data.resumen.canon_arrendamiento) : 'N/A'}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {dashboardData.data?.resumen?.canon_arrendamiento_m2 ? 
                        `${formatCurrency(dashboardData.data.resumen.canon_arrendamiento_m2)} por m²` : 
                        'N/A por m²'}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Going-in Yield % Año 1</span>
                      <span className="font-semibold text-blue-600">{formatPercent2Decimals(dashboardData.data?.resumen?.going_in_yield)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Cash-on-cash Yield % Año 1</span>
                      <span className="font-semibold text-blue-600">{formatPercent2Decimals(dashboardData.data?.resumen?.cash_on_cash_yield)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Retornos Estimados Anuales</span>
                      <span className="font-semibold text-purple-600">{formatPercent2Decimals(dashboardData.data?.resumen?.retornos_estimados)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-medium">Múltiplo de la Inversión</span>
                      <span className="font-bold text-green-600">{dashboardData.data?.resumen?.multiplo_inversion ? `${formatNumber2Decimals(dashboardData.data.resumen.multiplo_inversion)}x` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Final Sale to User */}
            <Card>
              <CardHeader>
                <CardTitle>Venta Final al Usuario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Valor de Venta Final</span>
                      <span className="font-semibold text-green-600">{dashboardData.data?.resumen?.valor_venta_final ? formatCurrency(dashboardData.data.resumen.valor_venta_final) : 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Aportes de Compra Durante el Programa</span>
                      <span className="font-semibold text-blue-600">{dashboardData.data?.resumen?.aportes_compra_programa ? formatCurrency(dashboardData.data.resumen.aportes_compra_programa) : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-medium">Saldo a Pagar con Crédito</span>
                      <span className="font-bold text-orange-600">{dashboardData.data?.resumen?.saldo_credito_vivienda ? formatCurrency(dashboardData.data.resumen.saldo_credito_vivienda) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Table - Investor View */}
          {dashboardData.data?.investor_cash_flow?.mes_numero?.length > 0 && (() => {
            const cashFlow = dashboardData.data.investor_cash_flow
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
                    <CardTitle className="text-base">Proyección de Flujo de Caja</CardTitle>
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
                          <th className="px-2 py-1 text-left font-medium text-gray-700 sticky left-0 z-10 bg-gray-100 w-42">Concepto</th>
                          {visibleHeaders.map((header: string, index: number) => (
                            <th key={index} className={`px-1 py-1 text-right font-medium text-gray-700 whitespace-nowrap ${cashFlowPage === 0 && index === 1 ? 'w-[95px]' : 'w-[85px]'} ${allMonths[startIdx + index] <= 1 ? 'bg-blue-50' : ''}`}>{header || '-'}</th>
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
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(+) Venta</td>
                          {getSlice(cashFlow.venta).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-green-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="bg-orange-50 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-orange-800">A Cargo del Usuario</td></tr>
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
                        <tr className="bg-purple-50 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-purple-800">A Cargo del Inversionista</td></tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Seguro Arrendamiento</td>
                          {getSlice(cashFlow.seguro_arrendamiento).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Ganancia Ocasional</td>
                          {getSlice(cashFlow.ganancia_ocasional).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) ICA</td>
                          {getSlice(cashFlow.ica).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) GMF</td>
                          {getSlice(cashFlow.gmf).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Comisión Gestión</td>
                          {getSlice(cashFlow.comision_toperty_gestion).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white">(-) Comisión Exit</td>
                          {getSlice(cashFlow.comision_toperty_exit).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right text-red-600 whitespace-nowrap`}>{value ? formatCurrency(value) : '-'}</td>
                          ))}
                          <td></td>
                        </tr>
                        <tr className="bg-gray-100 font-medium"><td colSpan={visibleCount + 2} className="px-2 py-1 text-gray-800">Flujo Operativo</td></tr>
                        <tr className="border-b hover:bg-gray-50 bg-gray-50">
                          <td className="px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white font-bold">(=) Flujo de Caja Operativo</td>
                          {getSlice(cashFlow.flujo_caja_operativo).map((value: number, i: number) => (
                            <td key={i} className={`px-2 py-1 text-right font-bold whitespace-nowrap ${value >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {value ? formatCurrency(value) : '-'}
                            </td>
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

          {/* Investment Highlights */}
          <Card>
            <CardHeader>
              <CardTitle>Highlights de la Inversión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-green-700">Fortalezas</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                      <span>Programa estructurado de {dashboardData.data?.flujo_interno?.program_months} meses</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                      <span>Cliente comprometido con cuota inicial de {formatCurrency(dashboardData.data?.flujo_interno?.user_down_payment)}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                      <span>Potencial de cuota inicial del {formatPercent(dashboardData.data?.flujo_interno?.potential_down_payment)}</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3 text-blue-700">Consideraciones</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                      <span>Sujeto a aprobación hipotecaria del cliente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                      <span>Fluctuaciones del mercado inmobiliario</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                      <span>Tiempo de ejecución del programa</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}