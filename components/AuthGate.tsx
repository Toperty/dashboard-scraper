"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogOut, AlertCircle, Settings } from "lucide-react"
import AuthService, { isGoogleAuthConfigured } from "@/lib/auth"
import { TopertyLogo, TopertyLogoCompact } from "@/components/toperty-logo"
import { useConfirm } from "@/hooks/use-confirm"

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null as any,
    loading: true,
    error: null as string | null
  })
  
  const authService = AuthService.getInstance()
  const { confirm } = useConfirm()

  useEffect(() => {
    // Verificar si Google Auth está configurado
    if (!isGoogleAuthConfigured()) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Google OAuth no está configurado. Por favor, configura GOOGLE_CLIENT_ID en el archivo .env.local" 
      }))
      return
    }

    // Inicializar Google OAuth
    const initAuth = async () => {
      try {
        await authService.initGoogleAuth()
        authService.restoreSession()
        setAuthState(prev => ({ ...prev, loading: false }))
      } catch (error) {
        console.error("Error al inicializar autenticación:", error)
        setAuthState(prev => ({ 
          ...prev, 
          loading: false, 
          error: "Error al inicializar el sistema de autenticación" 
        }))
      }
    }

    initAuth()

    // Suscribirse a cambios de autenticación
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: state.isAuthenticated,
        user: state.user
      }))
    })

    // Agregar el div para el botón de Google
    const googleButtonDiv = document.createElement('div')
    googleButtonDiv.id = 'google-signin-button'
    googleButtonDiv.style.display = 'none'
    document.body.appendChild(googleButtonDiv)

    // Listener para errores de email inválido
    const handleInvalidEmail = async (event: CustomEvent) => {
      await confirm(
        'Acceso restringido',
        `Solo se permite el acceso a correos corporativos de @toperty.co.

El correo ${event.detail.email} no está autorizado para acceder al sistema.`
      )
    }

    window.addEventListener('auth-invalid-email', handleInvalidEmail as unknown as EventListener)

    return () => {
      unsubscribe()
      window.removeEventListener('auth-invalid-email', handleInvalidEmail as unknown as EventListener)
      const buttonDiv = document.getElementById('google-signin-button')
      if (buttonDiv) {
        buttonDiv.remove()
      }
    }
  }, [])

  const handleGoogleSignIn = () => {
    try {
      // Mostrar el botón de Google Sign-In
      const buttonDiv = document.getElementById('google-signin-button')
      if (buttonDiv && window.google) {
        buttonDiv.style.display = 'block'
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          width: 250
        })
        
        // Hacer click automático en el botón
        setTimeout(() => {
          const googleBtn = buttonDiv.querySelector('[role="button"]') as HTMLElement
          if (googleBtn) {
            googleBtn.click()
            buttonDiv.style.display = 'none'
          }
        }, 100)
      } else {
        authService.signIn()
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error)
      setAuthState(prev => ({ ...prev, error: "Error al iniciar sesión con Google" }))
    }
  }

  const handleLogout = () => {
    authService.logout()
  }

  // Mostrar pantalla de carga
  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Cargando sistema de autenticación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si no está autenticado, mostrar pantalla de login
  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-8">
            <div className="flex justify-center mb-6">
              <TopertyLogo className="text-primary" width={140} height={50} />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Dashboard Scraper
            </CardTitle>
            <CardDescription className="text-base">
              Sistema de análisis inmobiliario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {authState.error && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  {authState.error.includes("configurado") ? (
                    <Settings className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  )}
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {authState.error.includes("configurado") ? "Configuración requerida" : "Error de autenticación"}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">{authState.error}</p>
                    {authState.error.includes("configurado") && (
                      <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded text-xs space-y-1">
                        <p className="font-semibold">Pasos para configurar:</p>
                        <ol className="list-decimal list-inside space-y-1 text-amber-700 dark:text-amber-400">
                          <li>Copia el archivo .env.local.example a .env.local</li>
                          <li>Obtén un Client ID desde Google Cloud Console</li>
                          <li>Agrega el Client ID al archivo .env.local</li>
                          <li>Reinicia la aplicación</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Inicia sesión con tu cuenta corporativa
                </p>
                <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full inline-block">
                  Solo correos @toperty.co
                </p>
              </div>
              
              <Button 
                onClick={handleGoogleSignIn}
                className="w-full h-12 text-base"
                size="lg"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Iniciar sesión con Google
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Al iniciar sesión, aceptas que solo los usuarios con correos
                corporativos @toperty.co pueden acceder a este sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si está autenticado, mostrar la aplicación con header de usuario
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 w-full items-center px-4">
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-3">
              <TopertyLogoCompact width={110} height={40} />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <p className="font-medium">{authState.user?.name}</p>
                <p className="text-xs text-muted-foreground">{authState.user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="w-full px-4">
        {children}
      </main>
    </div>
  )
}