"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Home,
  Percent,
  Calculator,
  Building,
  MapPin
} from 'lucide-react'

interface DashboardData {
  flujo_interno?: {
    area?: string
    commercial_value?: string
    average_purchase_value?: string
    asking_price?: string
    user_down_payment?: string
    program_months?: string
    potential_down_payment?: string
  }
  para_usuario?: {
    client_name?: string
    address?: string
    city?: string
    country?: string
    construction_year?: string
    stratum?: string
    apartment_type?: string
    private_parking?: string
  }
  cash_flow?: any[][]
  raw_data?: any[]
}

interface PaymentPlanDashboardProps {
  data: DashboardData
}

function formatCurrency(value: string | undefined): string {
  if (!value) return '$0'
  
  // Remove any non-numeric characters except dots and commas
  const cleanValue = value.replace(/[^\d.,]/g, '')
  
  // Try to parse the value
  const numValue = parseFloat(cleanValue.replace(/,/g, ''))
  
  if (isNaN(numValue)) return value
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numValue)
}

function formatPercent(value: string | undefined): string {
  if (!value) return '0%'
  
  // If it already has %, return as is
  if (value.includes('%')) return value
  
  const numValue = parseFloat(value)
  if (isNaN(numValue)) return value
  
  return `${numValue}%`
}

export default function PaymentPlanDashboard({ data }: PaymentPlanDashboardProps) {
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    // Calculate progress based on potential down payment percentage
    const potentialDownPayment = parseFloat(data.flujo_interno?.potential_down_payment?.replace('%', '') || '0')
    setProgress(Math.min(potentialDownPayment, 100))
  }, [data])

  // Debug: log data structure
  console.log('Dashboard data received:', data)

  // Check if data is available
  if (!data || (!data.flujo_interno && !data.para_usuario)) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Cargando datos...</h3>
            <p className="text-gray-600">
              Los datos del plan de pagos se están sincronizando desde Google Sheets.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Si este mensaje persiste, verifique que el Google Apps Script esté configurado correctamente.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Información del Programa (Campos C2-C6)
  const programInfo = [
    { label: 'Valor de Lanzamiento', value: formatCurrency(data.flujo_interno?.valor_lanzamiento) },
    { label: 'Tipo de Programa', value: data.flujo_interno?.tipo_programa || '-' },
    { label: 'Tipo de Vivienda', value: data.flujo_interno?.tipo_vivienda || '-' },
    { label: 'Con Alistamiento en la Entrega', value: data.flujo_interno?.con_alistamiento === 'Si' ? 'Sí' : 'No' },
    { label: 'Con Financiación de Gastos de Cierre', value: data.flujo_interno?.con_financiacion_gastos === 'Si' ? 'Sí' : 'No' }
  ]

  const metrics = [
    {
      title: 'Valor Comercial',
      value: formatCurrency(data.flujo_interno?.commercial_value),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Precio de Venta',
      value: formatCurrency(data.flujo_interno?.asking_price),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Cuota Inicial Usuario',
      value: formatCurrency(data.flujo_interno?.user_down_payment),
      icon: Calculator,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Meses del Programa',
      value: data.flujo_interno?.program_months || '0',
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  const propertyDetails = [
    { label: 'Dirección', value: data.para_usuario?.address, icon: MapPin },
    { label: 'Ciudad', value: data.para_usuario?.city },
    { label: 'Área', value: data.flujo_interno?.area ? `${data.flujo_interno.area} m²` : '-' },
    { label: 'Tipo', value: data.para_usuario?.apartment_type },
    { label: 'Estrato', value: data.para_usuario?.stratum },
    { label: 'Año de Construcción', value: data.para_usuario?.construction_year },
    { label: 'Parqueadero', value: data.para_usuario?.private_parking === 'SI' ? 'Sí' : 'No' }
  ]

  return (
    <div className="space-y-6">
      {/* Program Information Card - Campos C2-C6 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            Información del Programa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programInfo.map((info, index) => (
              <div key={index} className="flex flex-col">
                <span className="text-sm text-gray-500">{info.label}</span>
                <span className="text-base font-medium">{info.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
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

      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Cuota Inicial Potencial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-3xl font-bold text-green-600">
                {formatPercent(data.flujo_interno?.potential_down_payment)}
              </span>
              <span className="text-sm text-gray-500">
                del valor comercial
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Detalles de la Propiedad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {propertyDetails.map((detail, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-sm text-gray-500 min-w-[140px]">{detail.label}:</span>
                <span className="text-sm font-medium">{detail.value || '-'}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Table (if available) */}
      {data.cash_flow && data.cash_flow.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Flujo de Caja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    {data.cash_flow[0]?.map((header, index) => (
                      <th key={index} className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cash_flow.slice(1, 10).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b hover:bg-gray-50">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm">
                          {cellIndex > 0 && !isNaN(parseFloat(cell)) 
                            ? formatCurrency(cell)
                            : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.cash_flow.length > 10 && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Mostrando las primeras 10 filas de {data.cash_flow.length - 1}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data Debug (for development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader>
            <CardTitle>Debug: Raw Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-64 bg-gray-100 p-2 rounded">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}