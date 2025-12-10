"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { GeocodingService, GeocodeResult } from '@/lib/geocoding'

interface GeocodingContextType {
  geocoding: boolean
  lastGeocodedAddress: string
  currentCoordinates: { lat: number; lng: number } | null
  geocodeAddress: (address: string) => Promise<GeocodeResult>
  clearCoordinates: () => void
  setCoordinates: (coords: { lat: number; lng: number }) => void
}

const GeocodingContext = createContext<GeocodingContextType | undefined>(undefined)

interface GeocodingProviderProps {
  children: ReactNode
}

export function GeocodingProvider({ children }: GeocodingProviderProps) {
  const [geocoding, setGeocoding] = useState(false)
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState('')
  const [currentCoordinates, setCurrentCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  const geocodeAddress = useCallback(async (address: string): Promise<GeocodeResult> => {
    if (!address || address.trim() === '') {
      return {
        latitude: 0,
        longitude: 0,
        formatted_address: '',
        success: false,
        error: 'Dirección vacía'
      }
    }

    // Si ya hemos geocodificado esta dirección, devolver las coordenadas existentes
    if (address === lastGeocodedAddress && currentCoordinates) {
      return {
        latitude: currentCoordinates.lat,
        longitude: currentCoordinates.lng,
        formatted_address: address,
        success: true
      }
    }

    setGeocoding(true)
    
    try {
      const result = await GeocodingService.geocodeAddress(address)
      
      if (result.success) {
        const coords = {
          lat: result.latitude,
          lng: result.longitude
        }
        setCurrentCoordinates(coords)
        setLastGeocodedAddress(address)
      } else {
        // En caso de error, limpiar coordenadas previas solo si la dirección era diferente
        if (address !== lastGeocodedAddress) {
          setCurrentCoordinates(null)
          setLastGeocodedAddress('')
        }
      }
      
      return result
    } catch (error) {
      console.error('Error en geocodificación:', error)
      return {
        latitude: 0,
        longitude: 0,
        formatted_address: '',
        success: false,
        error: 'Error de conexión con el servicio de geocodificación'
      }
    } finally {
      setGeocoding(false)
    }
  }, [lastGeocodedAddress, currentCoordinates])

  const clearCoordinates = useCallback(() => {
    setCurrentCoordinates(null)
    setLastGeocodedAddress('')
  }, [])

  const setCoordinates = useCallback((coords: { lat: number; lng: number }) => {
    setCurrentCoordinates(coords)
  }, [])

  const value = {
    geocoding,
    lastGeocodedAddress,
    currentCoordinates,
    geocodeAddress,
    clearCoordinates,
    setCoordinates
  }

  return (
    <GeocodingContext.Provider value={value}>
      {children}
    </GeocodingContext.Provider>
  )
}

export function useGeocoding() {
  const context = useContext(GeocodingContext)
  if (context === undefined) {
    throw new Error('useGeocoding must be used within a GeocodingProvider')
  }
  return context
}