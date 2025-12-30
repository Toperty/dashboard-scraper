"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PaymentPlanDashboard from '@/components/payment-plan-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentDashboardPage() {
  const params = useParams()
  const token = params.token as string
  
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/dashboard/${token}`)
      
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

  const syncData = async () => {
    setSyncing(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/dashboard/${token}/sync`,
        { method: 'POST' }
      )
      
      if (response.status === 429) {
        const data = await response.json()
        alert(data.detail)
        return
      }
      
      if (response.ok) {
        const data = await response.json()
        setDashboardData(prev => ({
          ...prev,
          data: data.data,
          last_sync_at: data.last_sync_at
        }))
        alert('Datos sincronizados exitosamente')
      }
    } catch (err) {
      console.error('Error syncing:', err)
      alert('Error al sincronizar datos')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with expiration notice */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Plan de Pagos - {dashboardData.valuation_name}</h1>
              <p className="text-sm text-gray-600">Cliente: {dashboardData.client_name}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <Clock className="w-4 h-4" />
                  <span>
                    Válido por {dashboardData.days_remaining} días
                  </span>
                </div>
                {dashboardData.last_sync_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Última sincronización: {new Date(dashboardData.last_sync_at).toLocaleString('es-CO')}
                  </p>
                )}
              </div>
              
              <Button 
                onClick={syncData} 
                disabled={syncing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main dashboard content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PaymentPlanDashboard data={dashboardData.data} />
      </div>
      
      {/* Footer with view count */}
      <div className="text-center py-4 text-sm text-gray-500">
        Este dashboard ha sido visto {dashboardData.view_count} veces
      </div>
    </div>
  )
}