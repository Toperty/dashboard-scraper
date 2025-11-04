"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"

interface AlertState {
  isOpen: boolean
  title: string
  description: string
  onConfirm?: () => void
  confirmText: string
  variant: 'default' | 'success' | 'error' | 'warning'
}

interface AlertContextType {
  alert: (message: string, title?: string) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}

interface AlertProviderProps {
  children: ReactNode
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Aceptar',
    variant: 'default'
  })
  
  const showAlert = (config: Partial<AlertState>) => {
    setState(prev => ({ 
      ...prev, 
      ...config, 
      isOpen: true 
    }))
  }
  
  const hideAlert = () => {
    setState(prev => ({ 
      ...prev, 
      isOpen: false 
    }))
  }
  
  const alert = (message: string, title?: string) => {
    showAlert({
      title: title || 'Información',
      description: message,
      variant: 'default'
    })
  }
  
  const success = (message: string, title?: string) => {
    showAlert({
      title: title || '¡Éxito!',
      description: message,
      variant: 'success'
    })
  }
  
  const error = (message: string, title?: string) => {
    showAlert({
      title: title || 'Error',
      description: message,
      variant: 'error'
    })
  }
  
  const warning = (message: string, title?: string) => {
    showAlert({
      title: title || 'Advertencia',
      description: message,
      variant: 'warning'
    })
  }
  
  const handleConfirm = () => {
    if (state.onConfirm) {
      state.onConfirm()
    }
    hideAlert()
  }
  
  const getVariantStyles = () => {
    switch (state.variant) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-foreground'
    }
  }
  
  return (
    <AlertContext.Provider value={{ alert, success, error, warning }}>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={hideAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={getVariantStyles()}>
              {state.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirm}>
              {state.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertContext.Provider>
  )
}