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

interface ConfirmOptions {
  requireEmail?: boolean
  emailPlaceholder?: string
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
}

interface ConfirmResult {
  confirmed: boolean
  email?: string
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
  
  const confirm = (message: string, title?: string, options?: ConfirmOptions): Promise<ConfirmResult> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: title || 'Confirmar acción',
        description: message,
        confirmText: options?.requireEmail ? 'Enviar' : 'Confirmar',
        cancelText: 'Cancelar',
        requireEmail: options?.requireEmail || false,
        emailPlaceholder: options?.emailPlaceholder || 'correo@ejemplo.com'
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
    if (resolvePromise) {
      resolvePromise({ confirmed: false })
      setResolvePromise(null)
    }
    setState(prev => ({ ...prev, isOpen: false }))
    setEmail('')
    setEmailError('')
  }
  
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={(open) => {
        // Solo permitir cerrar si no requiere email o si el email es válido
        if (!open) {
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
            <AlertDialogDescription>
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
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {state.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {state.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}