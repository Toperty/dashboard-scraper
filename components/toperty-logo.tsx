import React from 'react'
import Image from 'next/image'

type LogoVariant = 'navy' | 'white'

interface TopertyLogoProps {
  className?: string
  width?: number
  height?: number
  /**
   * `navy` (por defecto): logo en tinta navy, para fondos claros.
   * `white`: logo blanco, para fondos navy/oscuros.
   */
  variant?: LogoVariant
}

const LOGO_SRC: Record<LogoVariant, string> = {
  navy: '/logo-toperty-dark.png',
  white: '/logo-toperty-light.png',
}

export function TopertyLogo({
  className = '',
  width = 110,
  height = 50,
  variant = 'navy',
}: TopertyLogoProps) {
  return (
    <Image
      src={LOGO_SRC[variant]}
      alt="Toperty"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}

// Versión compacta (mismo logo horizontal, tamaño reducido)
export function TopertyLogoCompact({
  className = '',
  width = 32,
  height = 32,
  variant = 'navy',
}: TopertyLogoProps) {
  return (
    <Image
      src={LOGO_SRC[variant]}
      alt="Toperty"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}
