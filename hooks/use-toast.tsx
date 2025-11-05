"use client"

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { Toast } from '@/components/ui/toast'

interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'loading'
  duration?: number
  progress?: number
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'loading', duration?: number) => string
  updateToast: (id: string, message: string, progress?: number) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'loading', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9)
    
    const initialProgress = type === 'loading' ? 0 : undefined
    setToasts(prev => [...prev, { id, message, type, duration, progress: initialProgress }])
    
    // Auto-hide toast after duration (except for loading type)
    if (type !== 'loading') {
      setTimeout(() => {
        hideToast(id)
      }, duration)
    }
    
    return id
  }, [])

  const updateToast = useCallback((id: string, message: string, progress?: number) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id 
        ? { ...toast, message, progress }
        : toast
    ))
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, updateToast, hideToast }}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          isVisible={true}
          progress={toast.progress}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}