"use client"

import React from 'react'
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info' | 'loading'
  isVisible: boolean
  progress?: number
  onClose: () => void
}

export function Toast({ message, type, isVisible, progress, onClose }: ToastProps) {
  const baseClasses = "fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform"
  
  const typeClasses = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white", 
    info: "bg-blue-600 text-white",
    loading: "bg-gray-600 text-white"
  }
  
  const typeIcons = {
    success: "✅",
    error: "❌",
    info: "ℹ️", 
    loading: "📧"
  }

  if (!isVisible) return null

  return (
    <div 
      className={cn(
        baseClasses,
        typeClasses[type],
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      )}
    >
      <div className="flex items-center gap-2">
        <span>{typeIcons[type]}</span>
        <span className="text-sm font-medium flex-1">{message}</span>
        <button 
          onClick={onClose}
          className="ml-auto text-white hover:text-gray-200 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}