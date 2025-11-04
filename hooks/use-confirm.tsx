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

interface ConfirmState {
  isOpen: boolean
  title: string
  description: string
  onConfirm?: () => void
  onCancel?: () => void
  confirmText: string
  cancelText: string
}

interface ConfirmContextType {
  confirm: (message: string, title?: string) => Promise<boolean>
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
    cancelText: 'Cancelar'
  })
  
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null)
  
  const confirm = (message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: title || 'Confirmar acción',
        description: message,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar'
      })
      setResolvePromise(() => resolve)
    })
  }
  
  const handleConfirm = () => {
    if (resolvePromise) {
      resolvePromise(true)
      setResolvePromise(null)
    }
    setState(prev => ({ ...prev, isOpen: false }))
  }
  
  const handleCancel = () => {
    if (resolvePromise) {
      resolvePromise(false)
      setResolvePromise(null)
    }
    setState(prev => ({ ...prev, isOpen: false }))
  }
  
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.isOpen} onOpenChange={handleCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
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