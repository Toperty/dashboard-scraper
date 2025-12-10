import { useState, useCallback } from 'react'
import { GeocodingService, GeocodeResult } from '@/lib/geocoding'

interface UseGeocodingReturn {
  geocoding: boolean
  lastGeocodedAddress: string
  currentCoordinates: { lat: number; lng: number } | null
  geocodeAddress: (address: string) => Promise<GeocodeResult>
  clearCoordinates: () => void
  setCoordinates: (coords: { lat: number; lng: number }) => void
}

export function useGeocoding(): UseGeocodingReturn {
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
        setCurrentCoordinates(null)
        setLastGeocodedAddress('')
      }
      
      return result
    } catch (error) {
      setCurrentCoordinates(null)
      setLastGeocodedAddress('')
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
  }, [])

  const clearCoordinates = useCallback(() => {
    setCurrentCoordinates(null)
    setLastGeocodedAddress('')
  }, [])

  const setCoordinates = useCallback((coords: { lat: number; lng: number }) => {
    setCurrentCoordinates(coords)
  }, [])

  return {
    geocoding,
    lastGeocodedAddress,
    currentCoordinates,
    geocodeAddress,
    clearCoordinates,
    setCoordinates
  }
}