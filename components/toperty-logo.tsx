import React from 'react'
import Image from 'next/image'

interface TopertyLogoProps {
  className?: string
  width?: number
  height?: number
}

export function TopertyLogo({ className = '', width = 110, height = 50 }: TopertyLogoProps) {
  return (
    <Image
      src="/logo-toperty-horizontal.png"
      alt="Toperty Logo"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}

// Versión compacta con logo cuadrado
export function TopertyLogoCompact({ className = '', width = 32, height = 32 }: TopertyLogoProps) {
  return (
    <Image
      src="/logo-toperty-horizontal.png"
      alt="Toperty"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}