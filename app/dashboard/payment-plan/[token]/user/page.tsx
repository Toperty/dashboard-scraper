"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, RefreshCw, Home, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export default function UserDashboardPage() {
  const params = useParams()
  const token = params.token as string
  
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const potentialDownPayment = parseFloat(dashboardData.data?.flujo_interno?.potential_down_payment?.replace('%', '') || '0')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
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
              <Button
                onClick={() => window.open(dashboardData.sheet_url, '_blank')}
                variant="default"
                size="sm"
                className="mt-2"
              >
                Ver Detalles Completos
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
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
                    {potentialDownPayment.toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500">
                    de cuota inicial potencial
                  </span>
                </div>
                <Progress value={potentialDownPayment} className="h-4" />
                <p className="text-sm text-gray-600">
                  Al completar el programa, podrás acceder a financiación hipotecaria con esta cuota inicial.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Property details */}
          {dashboardData.data?.para_usuario && (
            <Card>
              <CardHeader>
                <CardTitle>Detalles de tu Futura Propiedad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">Dirección:</span>
                      <p className="font-medium">{dashboardData.data.para_usuario.address}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Ciudad:</span>
                      <p className="font-medium">{dashboardData.data.para_usuario.city}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Estrato:</span>
                      <p className="font-medium">{dashboardData.data.para_usuario.stratum}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">Año de construcción:</span>
                      <p className="font-medium">{dashboardData.data.para_usuario.construction_year}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Tipo:</span>
                      <p className="font-medium">{dashboardData.data.para_usuario.apartment_type}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Parqueadero:</span>
                      <p className="font-medium">{dashboardData.data.para_usuario.private_parking ? 'Sí' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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