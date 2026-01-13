"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel,
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

interface ConfirmButton {
  text: string
  value: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

interface ConfirmOptions {
  requireEmail?: boolean
  emailPlaceholder?: string
  buttons?: ConfirmButton[]
}

interface ConfirmState {
  isOpen: boolean
  title: string
  description: string
  onConfirm?: () => void
  onCancel?: () => void
  confirmText: string
  cancelText: string
  requireEmail: boolean
  emailPlaceholder: string
  buttons?: ConfirmButton[]
}

interface ConfirmResult {
  confirmed: boolean
  email?: string
  value?: string
}

interface ConfirmContextType {
  confirm: (message: string, title?: string, options?: ConfirmOptions) => Promise<ConfirmResult>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return context
}

interface ConfirmProviderProps {
  children: ReactNode
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    requireEmail: false,
    emailPlaceholder: 'correo@ejemplo.com'
  })
  
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [resolvePromise, setResolvePromise] = useState<((value: ConfirmResult) => void) | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  
  const confirm = (message: string, title?: string, options?: ConfirmOptions): Promise<ConfirmResult> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: title || 'Confirmar acción',
        description: message,
        confirmText: options?.requireEmail ? 'Enviar' : 'Confirmar',
        cancelText: 'Cancelar',
        requireEmail: options?.requireEmail || false,
        emailPlaceholder: options?.emailPlaceholder || 'correo@ejemplo.com',
        buttons: options?.buttons
      })
      setEmail('')
      setEmailError('')
      setResolvePromise(() => resolve)
    })
  }
  
  const handleConfirm = () => {
    // Si requiere email, validar antes de continuar
    if (state.requireEmail) {
      const trimmedEmail = email.trim()
      
      if (!trimmedEmail || !trimmedEmail.includes('@') || trimmedEmail.length < 5) {
        setEmailError('Por favor ingresa un email válido')
        return // No cerrar el modal
      }
      setEmailError('')
    }
    if (resolvePromise) {
      resolvePromise({
        confirmed: true,
        email: state.requireEmail ? email.trim() : undefined
      })
      setResolvePromise(null)
    }
    setState(prev => ({ ...prev, isOpen: false }))
    setEmail('')
    setEmailError('')
  }
  
  const handleCancel = () => {
    if (isClosing) return // Evitar doble cierre
    setIsClosing(true)
    if (resolvePromise) {
      resolvePromise({ confirmed: false })
      setResolvePromise(null)
    }
    setState(prev => ({ ...prev, isOpen: false }))
    setEmail('')
    setEmailError('')
    setTimeout(() => setIsClosing(false), 100)
  }
  
  const handleButtonClick = (value: string) => {
    if (isClosing) return // Evitar doble cierre
    setIsClosing(true)
    if (resolvePromise) {
      resolvePromise({
        confirmed: true,
        value: value,
        email: state.requireEmail ? email.trim() : undefined
      })
      setResolvePromise(null)
    }
    setState(prev => ({ ...prev, isOpen: false }))
    setEmail('')
    setEmailError('')
    setTimeout(() => setIsClosing(false), 100)
  }
  
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={(open) => {
        if (!open && !isClosing) {
          // Solo permitir cerrar si no requiere email o si el email es válido
          if (state.requireEmail && (!email.trim() || !email.includes('@'))) {
            // No cerrar si requiere email y no es válido
            return
          }
          handleCancel()
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {state.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {state.requireEmail && (
            <div className="grid gap-2 py-4">
              <Input
                type="email"
                placeholder={state.emailPlaceholder}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('') // Limpiar error al escribir
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirm()
                  }
                }}
                autoFocus
              />
              {emailError && (
                <p className="text-sm text-red-600 mt-1">{emailError}</p>
              )}
            </div>
          )}
          
          <AlertDialogFooter className="flex-col gap-1">
            {state.buttons && state.buttons.length > 0 ? (
              <div className="flex flex-col gap-1 w-full">
                {/* Si hay más de 3 botones, mostrarlos como lista de acciones */}
                {state.buttons.length > 3 ? (
                  <>
                    <div className="text-sm text-gray-500 mb-2">Acciones disponibles:</div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {state.buttons.slice(0, -1).map((button, index) => {
                        const isEdit = button.value === 'edit'
                        return (
                          <button
                            key={index}
                            onClick={() => handleButtonClick(button.value)}
                            className={`w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group ${
                              isEdit ? 
                              'bg-amber-50 hover:bg-amber-100 text-amber-900' :
                              'bg-gray-50 hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <span className="font-medium">{button.text}</span>
                            <span className="text-gray-400 group-hover:text-gray-600">→</span>
                          </button>
                        )
                      })}
                    </div>
                    {/* Botón de cancelar separado */}
                    <div className="mt-2 pt-2 border-t">
                      <AlertDialogCancel
                        onClick={handleCancel}
                        className="w-full px-4 py-2 rounded-md font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        {state.buttons[state.buttons.length - 1].text}
                      </AlertDialogCancel>
                    </div>
                  </>
                ) : (
                  /* Si hay 3 o menos botones, mostrarlos en grid */
                  <div className={`grid gap-2 w-full grid-cols-${Math.min(state.buttons.length, 3)}`}>
                    {state.buttons.map((button, index) => {
                      const isCancel = button.variant === 'ghost' || button.value === 'cancel'
                      const ButtonComponent = isCancel ? AlertDialogCancel : AlertDialogAction
                      
                      const getButtonClass = () => {
                        switch(button.variant) {
                          case 'outline':
                            return 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          case 'secondary':
                            return 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          case 'ghost':
                            return 'bg-transparent text-gray-600 hover:bg-gray-100'
                          case 'default':
                          default:
                            return 'bg-blue-600 text-white hover:bg-blue-700'
                        }
                      }
                      
                      return (
                        <ButtonComponent
                          key={index}
                          onClick={() => isCancel ? handleCancel() : handleButtonClick(button.value)}
                          className={`px-4 py-2 rounded-md font-medium transition-colors text-center ${getButtonClass()}`}
                        >
                          {button.text}
                        </ButtonComponent>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                <AlertDialogCancel onClick={handleCancel}>
                  {state.cancelText}
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirm}>
                  {state.confirmText}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}