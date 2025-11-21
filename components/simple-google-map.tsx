"use client"
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RotateCcw, ChevronDown } from 'lucide-react'
import { fetchCitiesList, type CityOption } from '@/lib/api'
import { useAlert } from '@/hooks/use-alert'

// Variable global para controlar si Google Maps ya está cargado
let isGoogleMapsLoaded = false
let isGoogleMapsLoading = false

declare const google: any;

export function SimpleGoogleMap() {
  const { warning } = useAlert()
  const [map, setMap] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [cities, setCities] = useState<CityOption[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const [boundaryType, setBoundaryType] = useState<'country' | 'admin_level_1' | 'admin_level_2' | 'postal_code'>('country')
  const [colorStyle, setColorStyle] = useState<'simple' | 'random'>('simple')
  const [featureLayer, setFeatureLayer] = useState<any>(null)
  const [infoWindow, setInfoWindow] = useState<any>(null)
  const [statsCache, setStatsCache] = useState<Record<string, any>>({})
  const [propertyTypes, setPropertyTypes] = useState<string[]>(['apartamento', 'casa'])
  const [propertyTypeDropdownOpen, setPropertyTypeDropdownOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [lastClickedZone, setLastClickedZone] = useState<{zoneName: string, feature: any, latLng: any} | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadGoogleMaps()
    loadCities()
    
    // Cerrar dropdown al hacer click fuera
    const handleClickOutside = (event: MouseEvent) => {
      if (propertyTypeDropdownOpen) {
        const target = event.target as HTMLElement
        if (!target.closest('.relative')) {
          setPropertyTypeDropdownOpen(false)
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [propertyTypeDropdownOpen])
  const loadCities = async () => {
    try {
      const citiesData = await fetchCitiesList()
      setCities([{ id: 0, name: 'Todas las ciudades' }, ...citiesData])
    } catch (error) {
      console.error('Error cargando ciudades:', error)
    }
  }
  
  const updateMapView = (cityId: string) => {
    if (!map) return
    
    // Si es 'all', mostrar Colombia completa
    if (cityId === 'all') {
      map.setCenter({ lat: 4.5709, lng: -74.2973 })
      map.setZoom(6)
      return
    }
    
    // Buscar la ciudad en la lista
    const city = cities.find(c => c.id.toString() === cityId)
    if (city && city.id !== 0) {
      // Usar Geocoding API para obtener coordenadas
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ 
        address: `${city.name}, Colombia`,
        componentRestrictions: { country: 'CO' }
      }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location
          map.setCenter(location)
          map.setZoom(12)
        } else {
          // Fallback a Colombia completa
          map.setCenter({ lat: 4.5709, lng: -74.2973 })
          map.setZoom(6)
        }
      })
    }
  }

  const loadGoogleMaps = () => {
    if (isGoogleMapsLoaded && typeof google !== 'undefined') {
      console.log('Google Maps ya está disponible')
      initializeMap()
      return
    }

    if (isGoogleMapsLoading) {
      console.log('Google Maps ya se está cargando, esperando...')
      const checkInterval = setInterval(() => {
        if (isGoogleMapsLoaded && typeof google !== 'undefined') {
          clearInterval(checkInterval)
          initializeMap()
        }
      }, 500)
      return
    }

    isGoogleMapsLoading = true

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}&v=beta&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      isGoogleMapsLoaded = true
      isGoogleMapsLoading = false
      initializeMap()
    }
    script.onerror = () => {
      isGoogleMapsLoading = false
    }
    document.head.appendChild(script)
  }

  const initializeMap = () => {
    if (!mapRef.current || map) return

    try {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
      
      // Iniciar con vista de Colombia completa
      const googleMap = new google.maps.Map(mapRef.current, {
        center: { lat: 4.5709, lng: -74.2973 },
        zoom: 6,
        mapId: mapId,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
      })

      setMap(googleMap)
      console.log('✅ Mapa inicializado con Map ID:', mapId)
      
      // Crear InfoWindow para mostrar estadísticas
      const iw = new google.maps.InfoWindow()
      setInfoWindow(iw)
    } catch (error) {
      console.error('Error inicializando mapa:', error)
    }
  }

  const loadAdministrativeBoundaries = () => {
    if (!map) {
      console.log('❌ Mapa no inicializado')
      return
    }

    if (typeof google === 'undefined' || !google.maps) {
      console.log('❌ Google Maps no disponible')
      return
    }

    setLoading(true)
    clearMap()

    try {
      const featureTypeMap: Record<string, string> = {
        'country': 'COUNTRY',
        'admin_level_1': 'ADMINISTRATIVE_AREA_LEVEL_1',
        'admin_level_2': 'ADMINISTRATIVE_AREA_LEVEL_2',
        'postal_code': 'POSTAL_CODE',
      }

      const featureType = featureTypeMap[boundaryType]
      console.log(`🗺️ Cargando ${boundaryType} (${featureType})...`)

      const layer = map.getFeatureLayer(featureType)
      
      const styleFunction = (params: any) => {
        const feature = params.feature
        const placeId = feature.placeId
        
        if (colorStyle === 'simple') {
          return {
            fillColor: '#4285F4',
            fillOpacity: 0.1,
            strokeColor: '#1a73e8',
            strokeWeight: 2
          }
        } else if (colorStyle === 'random') {
          const hash = placeId.split('').reduce((acc: number, char: string) => {
            return char.charCodeAt(0) + ((acc << 5) - acc)
          }, 0)
          const hue = Math.abs(hash % 360)
          return {
            fillColor: `hsl(${hue}, 70%, 50%)`,
            fillOpacity: 0.4,
            strokeColor: `hsl(${hue}, 70%, 30%)`,
            strokeWeight: 2
          }
        }
        
        return {
          fillColor: '#4285F4',
          fillOpacity: 0.1,
          strokeColor: '#1a73e8',
          strokeWeight: 2
        }
      }

      layer.style = styleFunction
      setFeatureLayer(layer)
      
      // Agregar event listener para clicks en las zonas
      layer.addListener('click', async (event: any) => {
        const feature = event.features[0]
        if (feature) {
          // Intentar obtener un nombre amigable para la zona
          let zoneName = feature.displayName
          
          // Si displayName está vacío, usar geocoding para obtener el nombre
          if (!zoneName || zoneName.trim() === '') {
            // Obtener el centro aproximado del feature (usando el click location)
            const clickLocation = event.latLng
            
            if (clickLocation) {
              const geocoder = new google.maps.Geocoder()
              try {
                await new Promise<void>((resolve) => {
                  geocoder.geocode({ location: clickLocation }, (results: any, status: any) => {
                    if (status === 'OK' && results[0]) {
                      // Buscar el componente de dirección apropiado según el boundaryType
                      for (const component of results[0].address_components) {
                        if (boundaryType === 'country' && component.types.includes('country')) {
                          zoneName = component.long_name
                          break
                        } else if (boundaryType === 'admin_level_1' && component.types.includes('administrative_area_level_1')) {
                          zoneName = component.long_name
                          break
                        } else if (boundaryType === 'admin_level_2' && component.types.includes('administrative_area_level_2')) {
                          zoneName = component.long_name
                          break
                        } else if (boundaryType === 'postal_code' && component.types.includes('postal_code')) {
                          zoneName = component.long_name
                          break
                        }
                      }
                    }
                    resolve()
                  })
                })
              } catch (error) {
                console.error('Error obteniendo nombre de zona:', error)
              }
            }
          }
          
          // Si aún no hay nombre, usar el placeId como último recurso
          if (!zoneName || zoneName.trim() === '') {
            // Intentar usar el lugar del resultado de geocoding
            const clickLocation = event.latLng
            if (clickLocation) {
              const geocoder = new google.maps.Geocoder()
              try {
                const result = await new Promise<string>((resolve) => {
                  geocoder.geocode({ location: clickLocation }, (results: any, status: any) => {
                    if (status === 'OK' && results[0]) {
                      // Usar el nombre formateado del primer resultado
                      const addressComponents = results[0].address_components
                      // Buscar localidad, barrio o cualquier nombre útil
                      for (const component of addressComponents) {
                        if (component.types.includes('locality') || 
                            component.types.includes('sublocality') ||
                            component.types.includes('neighborhood')) {
                          resolve(component.long_name)
                          return
                        }
                      }
                      // Si no hay nada, usar formatted_address simplificado
                      const simplified = results[0].formatted_address.split(',')[0]
                      resolve(simplified)
                    } else {
                      resolve(feature.placeId)
                    }
                  })
                })
                zoneName = result
              } catch (error) {
                console.error('Error obteniendo nombre:', error)
                zoneName = feature.placeId
              }
            } else {
              zoneName = feature.placeId
            }
          }
          
          console.log(`📍 Zona seleccionada: ${zoneName}`)
          handleZoneClick(zoneName, feature, event.latLng)
        }
      })

      console.log('✅ Límites administrativos cargados')
      setLoading(false)
    } catch (error) {
      console.error('Error cargando límites administrativos:', error)
      setLoading(false)
    }
  }

  const handlePropertyTypeToggle = (type: string) => {
    setPropertyTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
    // No limpiar cache automáticamente - esperar a "Aplicar Filtros"
  }

  const handleDateChange = (type: 'from' | 'to', value: string) => {
    // Validaciones de fecha
    const MIN_DATE = '2024-02-15' // Fecha inicial de datos
    const today = new Date().toISOString().split('T')[0]
    
    if (value) {
      // No puede ser menor a la fecha mínima
      if (value < MIN_DATE) {
        warning(`La fecha no puede ser anterior a ${MIN_DATE}`, 'Fecha inválida')
        return
      }
      
      // No puede ser mayor a hoy
      if (value > today) {
        warning('La fecha no puede ser posterior al día de hoy', 'Fecha inválida')
        return
      }
      
      // Si es "desde", no puede ser mayor a "hasta"
      if (type === 'from' && dateTo && value > dateTo) {
        warning('La fecha "desde" no puede ser mayor que la fecha "hasta"', 'Rango de fechas inválido')
        return
      }
      
      // Si es "hasta", no puede ser menor a "desde"
      if (type === 'to' && dateFrom && value < dateFrom) {
        warning('La fecha "hasta" no puede ser menor que la fecha "desde"', 'Rango de fechas inválido')
        return
      }
    }
    
    if (type === 'from') {
      setDateFrom(value)
    } else {
      setDateTo(value)
    }
    // No limpiar cache automáticamente - esperar a "Aplicar Filtros"
  }

  const handleZoneClick = async (zoneName: string, feature: any, clickLatLng: any) => {
    console.log(`🖱️ Click en zona: ${zoneName}`)
    
    // Guardar la zona clickeada para recargas automáticas
    setLastClickedZone({ zoneName, feature, latLng: clickLatLng })
    
    // Verificar si ya tenemos las estadísticas en caché
    const cacheKey = `${boundaryType}_${selectedCity}_${zoneName}_${propertyTypes.join(',')}_${dateFrom}_${dateTo}`
    console.log(`🔑 Cache key: ${cacheKey}`)
    console.log(`📦 Cache exists: ${!!statsCache[cacheKey]}`)
    console.log(`🏠 Property types in state: [${propertyTypes.join(', ')}]`)
    
    if (statsCache[cacheKey]) {
      console.log('📦 Usando estadísticas en caché - OMITIENDO LLAMADA A API')
      const cached = statsCache[cacheKey]
      console.log('📦 Cached zoneDetails:', {
        hasZoneDetails: !!cached.zoneDetails,
        propertyCount: cached.zoneDetails?.filtered_period?.property_count,
        saleCount: cached.zoneDetails?.filtered_period?.sale_count,
        rentCount: cached.zoneDetails?.filtered_period?.rent_count
      })
      showInfoWindow(zoneName, cached, clickLatLng, cached.zoneDetails || null)
      return
    }
    
    // Mostrar loading en InfoWindow
    if (infoWindow) {
      infoWindow.setContent(`
        <div style="padding: 15px; min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 10px;">📊 ${zoneName}</div>
          <div style="text-align: center; padding: 20px;">
            <div style="display: inline-block; border: 2px solid #3b82f6; border-top-color: transparent; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div>
            <style>@keyframes spin { to { transform: rotate(360deg); }}</style>
            <div style="margin-top: 10px; color: #666;">Calculando...</div>
          </div>
        </div>
      `)
      infoWindow.setPosition(clickLatLng)
      infoWindow.open(map)
    }
    
    try {
      // Obtener el bounding box de la feature usando Places API
      let bounds: any = null
      
      if (feature.placeId) {
        const placesService = new google.maps.places.PlacesService(map)
        
        bounds = await new Promise((resolve) => {
          placesService.getDetails(
            {
              placeId: feature.placeId,
              fields: ['geometry']
            },
            (place: any, status: any) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.viewport) {
                //console.log('✅ Bounds obtenidos de Places API')
                resolve(place.geometry.viewport)
              } else {
                console.warn('⚠️ No se pudo obtener bounds de Places, usando viewport')
                resolve(map.getBounds())
              }
            }
          )
        })
      } else {
        console.warn('⚠️ No hay placeId, usando viewport')
        bounds = map.getBounds()
      }
      
      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      
      // NO enviar city_id - las coordenadas del bounding box ya definen la zona exacta
      const boundsParam = `&north=${ne.lat()}&south=${sw.lat()}&east=${ne.lng()}&west=${sw.lng()}`
      const propertyTypeParam = propertyTypes.length > 0 ? `&property_type=${propertyTypes.join(',')}` : ''
      const dateFromParam = dateFrom ? `&updated_date_from=${dateFrom}` : ''
      const dateToParam = dateTo ? `&updated_date_to=${dateTo}` : ''
      
      // console.log(`📊 === INICIANDO CONSULTA A API ===`)
      // console.log(`🏠 Property types being sent: [${propertyTypes.join(', ')}]`)
      // console.log(`📅 Date range: ${dateFrom || 'sin inicio'} - ${dateTo || 'sin fin'}`)
      
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/properties/by-zone?boundary_type=${boundaryType}${boundsParam}${propertyTypeParam}${dateFromParam}${dateToParam}`
      
      // console.log(`🗺️ Zona: ${zoneName}`)
      // console.log(`📍 Bounds de la zona:`)
      // console.log(`   Norte: ${ne.lat().toFixed(6)}`)
      // console.log(`   Sur: ${sw.lat().toFixed(6)}`)
      // console.log(`   Este: ${ne.lng().toFixed(6)}`)
      // console.log(`   Oeste: ${sw.lng().toFixed(6)}`)
      // console.log(`🏠 Tipos de inmueble: ${propertyTypes.join(', ') || 'Todos'}`)
      // console.log(`📅 Fechas: ${dateFrom || 'Sin inicio'} a ${dateTo || 'Sin fin'}`)
      // console.log(`🌐 API URL: ${apiUrl}`)
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) throw new Error('Error cargando estadísticas')
      
      const result = await response.json()
      if (result.status === 'success') {
        // Obtener detalles del endpoint zone-details (SIEMPRE, con o sin filtro de fecha)
        // Esto asegura que los cálculos respeten todos los filtros (ciudad, tipo, fecha)
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const params = new URLSearchParams({ zone_name: zoneName })
          
          if (dateFrom) {
            params.append('updated_date_from', dateFrom)
          }
          if (dateTo) {
            params.append('updated_date_to', dateTo)
          }
          if (propertyTypes.length > 0) {
            params.append('property_type', propertyTypes.join(','))
          }
          
          // Agregar coordenadas del bounding box
          if (bounds) {
            params.append('north', ne.lat().toString())
            params.append('south', sw.lat().toString())
            params.append('east', ne.lng().toString())
            params.append('west', sw.lng().toString())
          }
          
          const detailsUrl = `${baseUrl}/api/zone-details?${params.toString()}`
          
          const detailsResponse = await fetch(detailsUrl)
          const detailsData = await detailsResponse.json()
          
          if (detailsData.status === 'success') {
            // Guardar en caché SOLO zone details
            setStatsCache(prev => ({ 
              ...prev, 
              [cacheKey]: {
                zoneDetails: detailsData.data
              }
            }))
            showInfoWindow(zoneName, null, clickLatLng, detailsData.data)
          }
        } catch (error) {
          console.error('Error fetching zone details:', error)
        }
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
      if (infoWindow) {
        infoWindow.setContent(`
          <div style="padding: 15px;">
            <div style="color: #ef4444;">❌ Error cargando datos</div>
          </div>
        `)
      }
    }
  }

  const showInfoWindow = (zoneName: string, _stats: any, position: any, zoneDetails: any = null) => {
    if (!infoWindow) return
    
    // Usar SIEMPRE los datos de zone-details (único source of truth)
    const backendData = zoneDetails?.filtered_period
    
    if (!backendData) {
      // Si no hay datos del backend, no mostrar nada
      console.warn('⚠️ No hay datos del backend para mostrar')
      return
    }
    
    // Si hay comparación, mostrar lado a lado con el formato completo
    if (zoneDetails && zoneDetails.has_comparison && zoneDetails.current_period) {
      const filtered = zoneDetails.filtered_period
      const current = zoneDetails.current_period
      
      const content = `
        <div style="padding: 15px; min-width: 550px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #1f2937; text-align: center;">
            📊 ${zoneName}
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: start;">
            <!-- Período Filtrado -->
            <div>
              <div style="font-weight: 600; font-size: 12px; margin-bottom: 8px; color: #3b82f6; text-align: center;">Período Filtrado</div>
              <div style="font-size: 13px; color: #4b5563; margin-bottom: 8px; text-align: center;">
                Total: <strong>${filtered.property_count}</strong> propiedades
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px; text-align: center;">
                🏘️ Venta: ${filtered.sale_count} | Arriendo: ${filtered.rent_count}
              </div>
              ${filtered.sale_avg_price_m2 > 0 ? `
                <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">💰 Precio Venta/m²</div>
                  <div style="font-size: 16px; font-weight: 600; color: #1f2937;">$${Math.round(filtered.sale_avg_price_m2).toLocaleString()}</div>
                </div>
              ` : ''}
              ${filtered.rent_avg_price_m2 > 0 ? `
                <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">🏠 Precio Arriendo/m²</div>
                  <div style="font-size: 16px; font-weight: 600; color: #1f2937;">$${Math.round(filtered.rent_avg_price_m2).toLocaleString()}</div>
                </div>
              ` : ''}
              ${filtered.cap_rate > 0 ? `
                <div style="padding: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 6px; text-align: center;">
                  <div style="font-size: 11px; color: #e0e7ff; margin-bottom: 2px;">📈 Cap Rate</div>
                  <div style="font-size: 20px; font-weight: 700; color: white;">${(filtered.cap_rate * 100).toFixed(2)}%</div>
                </div>
              ` : ''}
            </div>
            
            <!-- VS Separator -->
            <div style="display: flex; align-items: center; justify-content: center; padding: 0 8px;">
              <div style="font-size: 18px; font-weight: 700; color: #9ca3af; padding-top: 100px;">VS</div>
            </div>
            
            <!-- Último Mes -->
            <div>
              <div style="font-weight: 600; font-size: 12px; margin-bottom: 8px; color: #10b981; text-align: center;">Último Mes</div>
              <div style="font-size: 13px; color: #4b5563; margin-bottom: 8px; text-align: center;">
                Total: <strong>${current.property_count}</strong> propiedades
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px; text-align: center;">
                🏘️ Venta: ${current.sale_count} | Arriendo: ${current.rent_count}
              </div>
              ${current.sale_avg_price_m2 > 0 ? `
                <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">💰 Precio Venta/m²</div>
                  <div style="font-size: 16px; font-weight: 600; color: #1f2937;">$${Math.round(current.sale_avg_price_m2).toLocaleString()}</div>
                </div>
              ` : ''}
              ${current.rent_avg_price_m2 > 0 ? `
                <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">🏠 Precio Arriendo/m²</div>
                  <div style="font-size: 16px; font-weight: 600; color: #1f2937;">$${Math.round(current.rent_avg_price_m2).toLocaleString()}</div>
                </div>
              ` : ''}
              ${current.cap_rate > 0 ? `
                <div style="padding: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 6px; text-align: center;">
                  <div style="font-size: 11px; color: #d1fae5; margin-bottom: 2px;">📈 Cap Rate</div>
                  <div style="font-size: 20px; font-weight: 700; color: white;">${(current.cap_rate * 100).toFixed(2)}%</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `
      
      infoWindow.setContent(content)
      infoWindow.setPosition(position)
      infoWindow.open(map)
      return
    }
    
    // Sin comparación - vista normal
    
    // USAR SOLO DATOS DEL BACKEND (ya filtrados)
    const propertyCount = backendData.property_count
    const saleCount = backendData.sale_count || 0
    const rentCount = backendData.rent_count || 0
    const salePriceM2 = backendData.sale_avg_price_m2
    const rentPrice = backendData.rent_avg_price_m2  // Este es el promedio de arriendo
    const capRate = backendData.cap_rate
    
    const content = `
      <div style="padding: 15px; min-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #1f2937;">
          📊 ${zoneName}
        </div>
        <div style="font-size: 13px; color: #4b5563; margin-bottom: 8px;">
          Total: <strong>${propertyCount}</strong> propiedades
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">
          🏘️ Venta: ${saleCount} | Arriendo: ${rentCount}
        </div>
        ${salePriceM2 > 0 ? `
          <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">💰 Precio Venta/m²</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">$${Math.round(salePriceM2).toLocaleString()}</div>
          </div>
        ` : ''}
        ${rentPrice > 0 ? `
          <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">🏠 Precio Arriendo/m²</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">$${Math.round(rentPrice).toLocaleString()}</div>
          </div>
        ` : ''}
        ${capRate > 0 ? `
          <div style="padding: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 6px; text-align: center;">
            <div style="font-size: 11px; color: #e0e7ff; margin-bottom: 2px;">📈 Tasa de Capitalización</div>
            <div style="font-size: 20px; font-weight: 700; color: white;">${(capRate * 100).toFixed(2)}%</div>
          </div>
        ` : ''}
      </div>
    `
    
    infoWindow.setContent(content)
    infoWindow.setPosition(position)
    infoWindow.open(map)
  }

  const clearMap = () => {
    if (featureLayer) {
      featureLayer.style = null
      setFeatureLayer(null)
    }
    if (infoWindow) {
      infoWindow.close()
    }
  }

  const filterPropertiesByFeature = async (properties: any[], feature: any): Promise<any[]> => {
    // Usar Google Maps Geometry para verificar si cada propiedad está dentro del polígono
    const filtered: any[] = []
    
    for (const prop of properties) {
      const point = new google.maps.LatLng(prop.latitude, prop.longitude)
      
      // Usar geocoding para verificar si la propiedad pertenece a esta zona
      const geocoder = new google.maps.Geocoder()
      
      try {
        await new Promise((resolve) => {
          geocoder.geocode({ location: point }, (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
              for (const component of results[0].address_components) {
                const displayName = feature.displayName || ''
                
                // Verificar si algún componente coincide con el nombre de la zona
                if (component.long_name === displayName || component.short_name === displayName) {
                  filtered.push(prop)
                  break
                }
              }
            }
            resolve(null)
          })
        })
        
        await new Promise(resolve => setTimeout(resolve, 30))
      } catch (error) {
        console.error('Error filtrando propiedad:', error)
      }
    }
    
    return filtered
  }

  const calculateStatsForProperties = (props: any[]) => {
    const forSale = props.filter(p => p.offer === 'sell' && p.price)
    const forRent = props.filter(p => p.offer === 'rent' && p.price)
    
    const avgSalePrice = forSale.length > 0 
      ? forSale.reduce((sum, p) => sum + p.price, 0) / forSale.length 
      : 0
      
    const avgRentPrice = forRent.length > 0
      ? forRent.reduce((sum, p) => sum + p.price, 0) / forRent.length
      : 0
    
    // Cap Rate = (Arriendo Anual / Precio Venta) * 100
    const capRate = avgSalePrice > 0 && avgRentPrice > 0
      ? ((avgRentPrice * 12) / avgSalePrice) * 100
      : 0
    
    return {
      total: props.length,
      forSale: forSale.length,
      forRent: forRent.length,
      avgSalePrice: Math.round(avgSalePrice),
      avgRentPrice: Math.round(avgRentPrice),
      capRate: capRate.toFixed(2)
    }
  }

  useEffect(() => {
    if (!map) return
    loadAdministrativeBoundaries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryType, colorStyle, map])

  useEffect(() => {
    updateMapView(selectedCity)
  }, [selectedCity, map])

  const resetFilters = () => {
    setBoundaryType('country')
    setColorStyle('simple')
    setSelectedCity('all')
    setPropertyTypes(['apartamento', 'casa'])
    setDateFrom('')
    setDateTo('')
    setStatsCache({})
    clearMap()
    if (map) {
      updateMapView('all')
    }
  }

  const applyFilters = () => {
    // Limpiar cache para forzar recarga
    setStatsCache({})
    
    // Si hay una zona clickeada, recargar sus estadísticas
    // Usar setTimeout para asegurar que el state se actualice antes de llamar handleZoneClick
    if (lastClickedZone && infoWindow) {
      setTimeout(() => {
        handleZoneClick(lastClickedZone.zoneName, lastClickedZone.feature, lastClickedZone.latLng)
      }, 0)
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="pb-4">
        <CardTitle>Límites Administrativos - Google Maps Data-Driven Styling</CardTitle>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Límite</label>
              <Select value={boundaryType} onValueChange={(value: 'country' | 'admin_level_1' | 'admin_level_2' | 'postal_code') => setBoundaryType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="country">País</SelectItem>
                  <SelectItem value="admin_level_1">Área Administrativa 1 (Departamentos)</SelectItem>
                  <SelectItem value="admin_level_2">Área Administrativa 2 (Municipios)</SelectItem>
                  <SelectItem value="postal_code">Código Postal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estilo de Color</label>
              <Select value={colorStyle} onValueChange={(value: 'simple' | 'random') => setColorStyle(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Límites Simples</SelectItem>
                  <SelectItem value="random">Colores Aleatorios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ciudad (zoom)</label>
              <Select value={selectedCity} onValueChange={(value) => setSelectedCity(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Colombia Completa</SelectItem>
                  {cities.filter(city => city.id !== 0).map((city) => (
                    <SelectItem key={city.id} value={city.id.toString()}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Filtros adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="space-y-2 relative">
              <label className="text-sm font-medium">Tipos de Inmueble</label>
              <div 
                className="relative"
                onClick={() => setPropertyTypeDropdownOpen(!propertyTypeDropdownOpen)}
              >
                <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer">
                  <span className="text-sm">
                    {propertyTypes.length === 0
                      ? 'Seleccionar tipos'
                      : propertyTypes.length === 1
                      ? propertyTypes[0].charAt(0).toUpperCase() + propertyTypes[0].slice(1)
                      : `${propertyTypes.length} seleccionados`
                    }
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </div>
              </div>
              {propertyTypeDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <div className="p-2 space-y-1">
                    {[
                      { value: 'apartamento', label: 'Apartamento' },
                      { value: 'casa', label: 'Casa' },
                      { value: 'oficina', label: 'Oficina' },
                      { value: 'local', label: 'Local' },
                      { value: 'bodega', label: 'Bodega' },
                      { value: 'lote', label: 'Lote' },
                      { value: 'finca', label: 'Finca' }
                    ].map((type) => (
                      <div
                        key={type.value}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePropertyTypeToggle(type.value)
                        }}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {propertyTypes.includes(type.value) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{type.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateChange('from', e.target.value)}
                placeholder="Fecha desde"
                min="2024-02-15"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateChange('to', e.target.value)}
                placeholder="Fecha hasta"
                min="2024-02-15"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <Button onClick={applyFilters}>
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 h-[calc(100%-12rem)] relative">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground font-medium">Cargando límites...</p>
            </div>
          </div>
        )}
        
        <div 
          ref={mapRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
      </CardContent>
    </Card>
  )
}
