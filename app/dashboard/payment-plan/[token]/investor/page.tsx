"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, RefreshCw, TrendingUp, DollarSign, BarChart3, PieChart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function InvestorDashboardPage() {
  const params = useParams()
  const token = params.token as string
  
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const formatCurrency = (value: string | undefined): string => {
    if (!value) return '$0'
    const numValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(/,/g, ''))
    if (isNaN(numValue)) return value
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numValue)
  }

  const formatPercent = (value: string | undefined): string => {
    if (!value) return '0%'
    if (value.includes('%')) return value
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return value
    return `${numValue.toFixed(1)}%`
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
      title: 'Inversión Total',
      value: formatCurrency(dashboardData.data?.flujo_interno?.total_investment),
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Capital requerido total'
    },
    {
      title: 'ROI Proyectado',
      value: formatPercent(dashboardData.data?.flujo_interno?.projected_roi),
      icon: PieChart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Retorno esperado de inversión'
    }
  ]

  const financialMetrics = [
    {
      label: 'Período de Inversión',
      value: `${dashboardData.data?.flujo_interno?.program_months || '0'} meses`,
      type: 'info'
    },
    {
      label: 'Rendimiento Mensual Estimado',
      value: formatCurrency(dashboardData.data?.flujo_interno?.monthly_payment),
      type: 'success'
    },
    {
      label: 'Retorno Total Estimado',
      value: formatCurrency(dashboardData.data?.flujo_interno?.estimated_return),
      type: 'success'
    },
    {
      label: 'Break Even',
      value: `${dashboardData.data?.metrics?.break_even_months || 'N/A'} meses`,
      type: 'warning'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Dashboard de Inversión</h1>
              <p className="text-gray-600">Análisis financiero - {dashboardData.valuation_name}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <Clock className="w-4 h-4" />
                  <span>Válido por {dashboardData.days_remaining} días</span>
                </div>
              </div>
              <Button
                onClick={() => window.open(dashboardData.sheet_url, '_blank')}
                variant="default"
                size="sm"
              >
                Ver Análisis Completo
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
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

          {/* Financial Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Investment Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Inversión</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {financialMetrics.map((metric, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <span className="text-gray-600">{metric.label}</span>
                      <span className={`font-semibold ${
                        metric.type === 'success' ? 'text-green-600' :
                        metric.type === 'warning' ? 'text-orange-600' :
                        'text-gray-900'
                      }`}>
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Riesgo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Escenario Optimista</h4>
                    <p className="text-sm text-green-700">
                      ROI: {formatPercent(dashboardData.data?.metrics?.best_case_roi)}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Escenario Esperado</h4>
                    <p className="text-sm text-blue-700">
                      ROI: {formatPercent(dashboardData.data?.metrics?.expected_roi)}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">Escenario Pesimista</h4>
                    <p className="text-sm text-orange-700">
                      ROI: {formatPercent(dashboardData.data?.metrics?.worst_case_roi)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Table */}
          {dashboardData.data?.cash_flow && dashboardData.data.cash_flow.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Proyección de Flujo de Caja</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        {dashboardData.data.cash_flow[0]?.map((header, index) => (
                          <th key={index} className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.data.cash_flow.slice(1, 13).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b hover:bg-gray-50">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 text-sm">
                              {cellIndex > 0 && !isNaN(parseFloat(cell)) 
                                ? formatCurrency(cell.toString())
                                : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dashboardData.data.cash_flow.length > 13 && (
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      Mostrando los primeros 12 meses. Ver análisis completo en Excel.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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