"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronLeft, ChevronRight, ExternalLink, MapPin, Download, RotateCcw, ChevronDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchProperties, fetchCitiesList, type PropertiesResponse, type CityOption } from "@/lib/api"
import { useAlert } from "@/hooks/use-alert"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { GeocodingService } from "@/lib/geocoding"

export function PropertyDatabaseView() {
  const [data, setData] = useState<PropertiesResponse | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
  const { success: showSuccess, error: showError } = useAlert()
  const { confirm } = useConfirm()
  const { showToast, hideToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState<string>('')
  const [currentCoordinates, setCurrentCoordinates] = useState<{lat: number, lng: number} | null>(null)
  const [propertyTypeDropdownOpen, setPropertyTypeDropdownOpen] = useState(false)
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false)
  const [roomsDropdownOpen, setRoomsDropdownOpen] = useState(false)
  const [bathsDropdownOpen, setBathsDropdownOpen] = useState(false)
  const [garagesDropdownOpen, setGaragesDropdownOpen] = useState(false)
  const [stratumDropdownOpen, setStratumDropdownOpen] = useState(false)
  const [antiquityDropdownOpen, setAntiquityDropdownOpen] = useState(false)
  
  // Filtros
  const [filters, setFilters] = useState({
    city_id: [] as string[],
    offer_type: 'all',
    min_price: '',
    max_price: '',
    min_sale_price: '',
    max_sale_price: '',
    min_rent_price: '',
    max_rent_price: '',
    min_area: '',
    max_area: '',
    rooms: [] as string[],
    baths: [] as string[],
    garages: [] as string[],
    stratum: [] as string[],
    antiquity: [] as string[],
    property_type: [] as string[],
    updated_date_from: '',
    updated_date_to: '',
    // Nuevos filtros de ubicación
    search_address: '',
    radius: '1000' // Radio en metros por defecto
  })
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)

  // Función para formatear input de precio mientras se escribe
  const formatPriceInput = (value: string): string => {
    if (!value) return ''
    // Remover caracteres no numéricos
    const numericValue = value.replace(/[^0-9]/g, '')
    if (!numericValue) return ''
    // Formatear con separadores de miles
    const formatted = parseInt(numericValue).toLocaleString('es-CO')
    return `$${formatted}`
  }

  // Función para limpiar formato de precio y obtener solo números
  const cleanPrice = (formattedPrice: string): string => {
    return formattedPrice.replace(/[^0-9]/g, '')
  }

  const loadPropertiesWithCoords = async (page: number = 1, newFilters = filters, coords: {lat: number, lng: number} | null = null) => {
    try {
      setLoading(true)
      setError(null)
      
      // Usar las coordenadas pasadas como parámetro si están disponibles, sino usar currentCoordinates
      // Si coords es explícitamente null, no usar coordenadas
      const coordsToUse = coords === null ? null : (coords || currentCoordinates)
      
      
      // Convertir strings vacíos a undefined y parsear números
      
      // Procesar rangos de antigüedad usando IDs categóricos para múltiples selecciones
      let antiquity_categories = [];
      let antiquity_filter = undefined;
      if (newFilters.antiquity.length > 0) {
        for (const ant of newFilters.antiquity) {
          switch(ant) {
            case '0-1': antiquity_categories.push(1); break;  // Menos de 1 año
            case '1-8': antiquity_categories.push(2); break;  // 1 a 8 años  
            case '9-15': antiquity_categories.push(3); break; // 9 a 15 años
            case '16-30': antiquity_categories.push(4); break; // 16 a 30 años
            case '30+': antiquity_categories.push(5); break;  // Más de 30 años
            case 'unspecified': antiquity_filter = 'unspecified'; break;
          }
        }
      }
      
      const cleanFilters = {
        city_ids: newFilters.city_id.length === 0 ? undefined : newFilters.city_id.map(id => parseInt(id)),
        offer_type: newFilters.offer_type === 'all' ? undefined : newFilters.offer_type,
        min_price: newFilters.min_price ? parseFloat(cleanPrice(newFilters.min_price)) : undefined,
        max_price: newFilters.max_price ? parseFloat(cleanPrice(newFilters.max_price)) : undefined,
        min_sale_price: newFilters.min_sale_price ? parseFloat(cleanPrice(newFilters.min_sale_price)) : undefined,
        max_sale_price: newFilters.max_sale_price ? parseFloat(cleanPrice(newFilters.max_sale_price)) : undefined,
        min_rent_price: newFilters.min_rent_price ? parseFloat(cleanPrice(newFilters.min_rent_price)) : undefined,
        max_rent_price: newFilters.max_rent_price ? parseFloat(cleanPrice(newFilters.max_rent_price)) : undefined,
        min_area: newFilters.min_area ? parseFloat(newFilters.min_area) : undefined,
        max_area: newFilters.max_area ? parseFloat(newFilters.max_area) : undefined,
        rooms: newFilters.rooms.length === 0 ? undefined : newFilters.rooms,
        baths: newFilters.baths.length === 0 ? undefined : newFilters.baths,
        garages: newFilters.garages.length === 0 ? undefined : newFilters.garages,
        stratums: newFilters.stratum.length === 0 ? undefined : newFilters.stratum.map(s => s === 'unspecified' ? 'unspecified' : s),
        antiquity_categories: antiquity_categories.length === 0 ? undefined : antiquity_categories,
        antiquity_filter: antiquity_filter,
        property_type: newFilters.property_type.length === 0 ? undefined : newFilters.property_type,
        updated_date_from: newFilters.updated_date_from || undefined,
        updated_date_to: newFilters.updated_date_to || undefined,
        // Filtros de ubicación
        search_address: newFilters.search_address || undefined,
        latitude: coordsToUse?.lat,
        longitude: coordsToUse?.lng,
        radius: newFilters.radius ? parseInt(newFilters.radius) : undefined
      }
      
      
      const result = await fetchProperties(page, pageSize, cleanFilters)
      setData(result)
      
    } catch (err) {
      setError('Error al cargar propiedades')
      console.error('Error loading properties:', err)
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Cargar ciudades
        const citiesList = await fetchCitiesList()
        setCities(citiesList)
        
        // Cargar propiedades con filtros limpios explícitos
        const emptyFilters = {
          city_id: [] as string[],
          offer_type: 'all',
          min_price: '',
          max_price: '',
          min_sale_price: '',
          max_sale_price: '',
          min_rent_price: '',
          max_rent_price: '',
          min_area: '',
          max_area: '',
          rooms: [] as string[],
          baths: [] as string[],
          garages: [] as string[],
          stratum: [] as string[],
          antiquity: [] as string[],
          property_type: [] as string[],
          updated_date_from: '',
          updated_date_to: '',
          // Nuevos filtros de ubicación
          search_address: '',
          radius: '1000'
        }
        loadPropertiesWithCoords(1, emptyFilters)
      } catch (error) {
        console.error('Error loading initial data:', error)
        setError('Error al cargar datos iniciales')
      }
    }
    
    loadInitialData()
  }, [])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.property-type-dropdown')) {
        setPropertyTypeDropdownOpen(false)
      }
      if (!target.closest('.city-dropdown')) {
        setCityDropdownOpen(false)
      }
      if (!target.closest('.rooms-dropdown')) {
        setRoomsDropdownOpen(false)
      }
      if (!target.closest('.baths-dropdown')) {
        setBathsDropdownOpen(false)
      }
      if (!target.closest('.garages-dropdown')) {
        setGaragesDropdownOpen(false)
      }
      if (!target.closest('.stratum-dropdown')) {
        setStratumDropdownOpen(false)
      }
      if (!target.closest('.antiquity-dropdown')) {
        setAntiquityDropdownOpen(false)
      }
    }

    if (propertyTypeDropdownOpen || cityDropdownOpen || roomsDropdownOpen || bathsDropdownOpen || garagesDropdownOpen || stratumDropdownOpen || antiquityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [propertyTypeDropdownOpen, cityDropdownOpen, roomsDropdownOpen, bathsDropdownOpen, garagesDropdownOpen, stratumDropdownOpen, antiquityDropdownOpen])

  const handleFilterChange = (key: string, value: string) => {
    // Formatear campos de precio
    if (key.includes('price') && value) {
      const formattedValue = formatPriceInput(value)
      setFilters(prev => ({ ...prev, [key]: formattedValue }))
    } else {
      setFilters(prev => ({ ...prev, [key]: value }))
    }
  }

  const handlePropertyTypeToggle = (propertyType: string) => {
    setFilters(prev => ({
      ...prev,
      property_type: prev.property_type.includes(propertyType)
        ? prev.property_type.filter(type => type !== propertyType)
        : [...prev.property_type, propertyType]
    }))
  }

  const handleCityToggle = (cityId: string) => {
    setFilters(prev => ({
      ...prev,
      city_id: prev.city_id.includes(cityId)
        ? prev.city_id.filter(id => id !== cityId)
        : [...prev.city_id, cityId]
    }))
  }

  const handleRoomsToggle = (rooms: string) => {
    setFilters(prev => ({
      ...prev,
      rooms: prev.rooms.includes(rooms)
        ? prev.rooms.filter(r => r !== rooms)
        : [...prev.rooms, rooms]
    }))
  }

  const handleBathsToggle = (baths: string) => {
    setFilters(prev => ({
      ...prev,
      baths: prev.baths.includes(baths)
        ? prev.baths.filter(b => b !== baths)
        : [...prev.baths, baths]
    }))
  }

  const handleGaragesToggle = (garages: string) => {
    setFilters(prev => ({
      ...prev,
      garages: prev.garages.includes(garages)
        ? prev.garages.filter(g => g !== garages)
        : [...prev.garages, garages]
    }))
  }

  const handleStratumToggle = (stratum: string) => {
    setFilters(prev => ({
      ...prev,
      stratum: prev.stratum.includes(stratum)
        ? prev.stratum.filter(s => s !== stratum)
        : [...prev.stratum, stratum]
    }))
  }

  const handleAntiquityToggle = (antiquity: string) => {
    setFilters(prev => ({
      ...prev,
      antiquity: prev.antiquity.includes(antiquity)
        ? prev.antiquity.filter(a => a !== antiquity)
        : [...prev.antiquity, antiquity]
    }))
  }



  const handleSearch = async () => {
    setCurrentPage(1)
    
    let coordsToUse = currentCoordinates
    
    // Si hay una dirección y no hemos geocodificado esta dirección antes
    if (filters.search_address && filters.search_address !== lastGeocodedAddress) {
      setGeocoding(true)
      
      try {
        const geocodeResult = await GeocodingService.geocodeAddress(filters.search_address)
        
        if (geocodeResult.success) {
          coordsToUse = {
            lat: geocodeResult.latitude,
            lng: geocodeResult.longitude
          }
          setCurrentCoordinates(coordsToUse)
          setLastGeocodedAddress(filters.search_address)
          showSuccess(`Dirección encontrada: ${geocodeResult.formatted_address}`)
        } else {
          showError(`Error al geocodificar: ${geocodeResult.error}`)
          coordsToUse = null
          setCurrentCoordinates(null)
        }
      } catch (error) {
        showError('Error al obtener coordenadas de la dirección')
        coordsToUse = null
        setCurrentCoordinates(null)
      } finally {
        setGeocoding(false)
      }
    }
    
    // Si no hay dirección, limpiar coordenadas
    if (!filters.search_address) {
      coordsToUse = null
      setCurrentCoordinates(null)
      setLastGeocodedAddress('')
    }
    
    // Llamar loadProperties con las coordenadas correctas
    await loadPropertiesWithCoords(1, filters, coordsToUse)
  }

  const handleClearFilters = async () => {
    const emptyFilters = {
      city_id: [] as string[],
      offer_type: 'all',
      min_price: '',
      max_price: '',
      min_sale_price: '',
      max_sale_price: '',
      min_rent_price: '',
      max_rent_price: '',
      min_area: '',
      max_area: '',
      rooms: [] as string[],
      baths: [] as string[],
      garages: [] as string[],
      stratum: [] as string[],
      antiquity: [] as string[],
      property_type: [] as string[],
      updated_date_from: '',
      updated_date_to: '',
      // Nuevos filtros de ubicación
      search_address: '',
      radius: '1000'
    }
    
    // Limpiar TODOS los estados relacionados de inmediato
    setCurrentCoordinates(null)
    setLastGeocodedAddress('')
    setCurrentPage(1)
    setPropertyTypeDropdownOpen(false)
    setCityDropdownOpen(false)
    setRoomsDropdownOpen(false)
    setBathsDropdownOpen(false)
    setGaragesDropdownOpen(false)
    setStratumDropdownOpen(false)
    setAntiquityDropdownOpen(false)
    setGeocoding(false)
    setError(null)
    
    // Limpiar datos actuales antes de cargar nuevos
    setData(null)
    setLoading(true)
    
    // Actualizar filtros
    setFilters(emptyFilters)
    
    // Cargar propiedades con filtros completamente limpios - usar null explícitamente para coordenadas
    await loadPropertiesWithCoords(1, emptyFilters, null)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    loadPropertiesWithCoords(newPage, filters)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-CO')
  }

  const handleExportToExcel = async () => {
    if (!data || data.pagination.total_count === 0) {
      showError('No hay datos para exportar')
      return
    }

    const totalCount = data.pagination.total_count
    const result = await confirm(
      `¿Deseas enviar por email TODAS las ${totalCount.toLocaleString()} propiedades disponibles?\n\nEsto incluirá todas las páginas de resultados en un archivo Excel.`,
      'Enviar Excel por Email',
      { 
        requireEmail: true,
        emailPlaceholder: 'correo@ejemplo.com'
      }
    )
    
    if (!result.confirmed || !result.email) return

    await handleSendExcelByEmail(result.email)
  }

  const handleSendExcelByEmail = async (email: string) => {
    let loadingToastId: string | null = null
    
    try {
      loadingToastId = showToast(`Enviando Excel a ${email}...`, 'loading')
      
      // Preparar filtros para el backend
      let antiquity_categories = [];
      let antiquity_filter = undefined;
      
      if (filters.antiquity.length > 0) {
        for (const ant of filters.antiquity) {
          switch(ant) {
            case '0-1': antiquity_categories.push(1); break;  // Menos de 1 año
            case '1-8': antiquity_categories.push(2); break;  // 1 a 8 años  
            case '9-15': antiquity_categories.push(3); break; // 9 a 15 años
            case '16-30': antiquity_categories.push(4); break; // 16 a 30 años
            case '30+': antiquity_categories.push(5); break;  // Más de 30 años
            case 'unspecified': antiquity_filter = 'unspecified'; break;
          }
        }
      }
      
      const cleanFilters = {
        city_ids: filters.city_id.length === 0 ? undefined : filters.city_id.map(id => parseInt(id)),
        offer_type: filters.offer_type === 'all' ? undefined : filters.offer_type,
        min_price: filters.min_price ? parseFloat(cleanPrice(filters.min_price)) : undefined,
        max_price: filters.max_price ? parseFloat(cleanPrice(filters.max_price)) : undefined,
        min_sale_price: filters.min_sale_price ? parseFloat(cleanPrice(filters.min_sale_price)) : undefined,
        max_sale_price: filters.max_sale_price ? parseFloat(cleanPrice(filters.max_sale_price)) : undefined,
        min_rent_price: filters.min_rent_price ? parseFloat(cleanPrice(filters.min_rent_price)) : undefined,
        max_rent_price: filters.max_rent_price ? parseFloat(cleanPrice(filters.max_rent_price)) : undefined,
        min_area: filters.min_area ? parseFloat(filters.min_area) : undefined,
        max_area: filters.max_area ? parseFloat(filters.max_area) : undefined,
        rooms: filters.rooms.length === 0 ? undefined : filters.rooms,
        baths: filters.baths.length === 0 ? undefined : filters.baths,
        garages: filters.garages.length === 0 ? undefined : filters.garages,
        stratums: filters.stratum.length === 0 ? undefined : filters.stratum.map(s => s === 'unspecified' ? 'unspecified' : s),
        antiquity_categories: antiquity_categories.length === 0 ? undefined : antiquity_categories,
        antiquity_filter: antiquity_filter,
        property_type: filters.property_type.length === 0 ? undefined : filters.property_type,
        updated_date_from: filters.updated_date_from || undefined,
        updated_date_to: filters.updated_date_to || undefined,
        search_address: filters.search_address || undefined,
        latitude: currentCoordinates?.lat,
        longitude: currentCoordinates?.lng,
        radius: filters.radius ? parseInt(filters.radius) : undefined
      }
      
      // Llamar al endpoint del backend para enviar el Excel por email
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/properties/send-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          filters: cleanFilters
        })
      })
      
      const result = await response.json()
      
      // Ocultar toast de loading
      if (loadingToastId) {
        hideToast(loadingToastId)
      }

      if (result.status === 'success') {
        showToast(`Excel enviado exitosamente a ${email}. ${result.properties_count} propiedades exportadas.`, 'success')
      } else {
        showToast(result.detail || 'Error al enviar el archivo', 'error')
      }

    } catch (error) {
      // Ocultar toast de loading
      if (loadingToastId) {
        hideToast(loadingToastId)
      }
      
      console.error('Error al enviar email:', error)
      showToast('Error al enviar el archivo por email. Por favor, inténtalo de nuevo.', 'error')
    }
  }

  return (
    <>
    <Card className="w-full max-w-none">
      <CardHeader>
        <CardTitle>Base de Datos de Propiedades</CardTitle>
        <p className="text-sm text-muted-foreground">
          Explora y filtra el inventario completo de propiedades
        </p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ciudad</label>
            <div className="relative city-dropdown">
              <Button
                variant="outline"
                onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.city_id.length === 0
                    ? "Cualquiera..."
                    : filters.city_id.length === 1
                    ? cities.find(c => c.id.toString() === filters.city_id[0])?.name || "Seleccionada"
                    : `${filters.city_id.length} ciudades seleccionadas`
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
              {cityDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {cities.map((city) => (
                      <div
                        key={city.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleCityToggle(city.id.toString())}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.city_id.includes(city.id.toString()) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{city.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Oferta</label>
            <Select value={filters.offer_type} onValueChange={(value) => handleFilterChange('offer_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sell">Venta</SelectItem>
                <SelectItem value="rent">Renta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {filters.offer_type === 'all' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio Venta Mínimo</label>
                <Input
                  type="text"
                  placeholder="$0"
                  value={filters.min_sale_price}
                  onChange={(e) => handleFilterChange('min_sale_price', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio Venta Máximo</label>
                <Input
                  type="text"
                  placeholder="Sin límite"
                  value={filters.max_sale_price}
                  onChange={(e) => handleFilterChange('max_sale_price', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Precio Arriendo Mínimo</label>
                <Input
                  type="text"
                  placeholder="$0"
                  value={filters.min_rent_price}
                  onChange={(e) => handleFilterChange('min_rent_price', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio Arriendo Máximo</label>
                <Input
                  type="text"
                  placeholder="Sin límite"
                  value={filters.max_rent_price}
                  onChange={(e) => handleFilterChange('max_rent_price', e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio Mínimo</label>
                <Input
                  type="text"
                  placeholder="$0"
                  value={filters.min_price}
                  onChange={(e) => handleFilterChange('min_price', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio Máximo</label>
                <Input
                  type="text"
                  placeholder="Sin límite"
                  value={filters.max_price}
                  onChange={(e) => handleFilterChange('max_price', e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Área Mínima (m²)</label>
            <Input
              type="number"
              placeholder="0"
              value={filters.min_area}
              onChange={(e) => handleFilterChange('min_area', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Área Máxima (m²)</label>
            <Input
              type="number"
              placeholder="Sin límite"
              value={filters.max_area}
              onChange={(e) => handleFilterChange('max_area', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Habitaciones</label>
            <div className="relative rooms-dropdown">
              <Button
                variant="outline"
                onClick={() => setRoomsDropdownOpen(!roomsDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.rooms.length === 0
                    ? "Cualquiera..."
                    : filters.rooms.length === 1
                    ? filters.rooms[0] === 'unspecified' ? 'Sin especificar' : filters.rooms[0]
                    : `${filters.rooms.length} seleccionadas`
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
              {roomsDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <div className="p-2 space-y-1">
                    {[
                      { value: 'unspecified', label: 'Sin especificar' },
                      { value: '0', label: '0' },
                      { value: '1', label: '1' },
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                      { value: '4', label: '4' },
                      { value: '5+', label: '5+' }
                    ].map((room) => (
                      <div
                        key={room.value}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleRoomsToggle(room.value)}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.rooms.includes(room.value) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{room.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Baños</label>
            <div className="relative baths-dropdown">
              <Button
                variant="outline"
                onClick={() => setBathsDropdownOpen(!bathsDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.baths.length === 0
                    ? "Cualquiera..."
                    : filters.baths.length === 1
                    ? filters.baths[0] === 'unspecified' ? 'Sin especificar' : filters.baths[0]
                    : `${filters.baths.length} seleccionados`
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
              {bathsDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <div className="p-2 space-y-1">
                    {[
                      { value: 'unspecified', label: 'Sin especificar' },
                      { value: '0', label: '0' },
                      { value: '1', label: '1' },
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                      { value: '4+', label: '4+' }
                    ].map((bath) => (
                      <div
                        key={bath.value}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleBathsToggle(bath.value)}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.baths.includes(bath.value) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{bath.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Garajes</label>
            <div className="relative garages-dropdown">
              <Button
                variant="outline"
                onClick={() => setGaragesDropdownOpen(!garagesDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.garages.length === 0
                    ? "Cualquiera..."
                    : filters.garages.length === 1
                    ? filters.garages[0] === 'unspecified' ? 'Sin especificar' : filters.garages[0]
                    : `${filters.garages.length} seleccionados`
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
              {garagesDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <div className="p-2 space-y-1">
                    {[
                      { value: 'unspecified', label: 'Sin especificar' },
                      { value: '0', label: '0' },
                      { value: '1', label: '1' },
                      { value: '2', label: '2' },
                      { value: '3+', label: '3+' }
                    ].map((garage) => (
                      <div
                        key={garage.value}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleGaragesToggle(garage.value)}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.garages.includes(garage.value) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{garage.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estrato</label>
            <div className="relative stratum-dropdown">
              <Button
                variant="outline"
                onClick={() => setStratumDropdownOpen(!stratumDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.stratum.length === 0
                    ? "Cualquiera..."
                    : filters.stratum.length === 1
                    ? filters.stratum[0] === 'unspecified' ? 'Sin especificar' : `Estrato ${filters.stratum[0]}`
                    : `${filters.stratum.length} estratos seleccionados`
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
              {stratumDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <div className="p-2 space-y-1">
                    {[
                      { value: 'unspecified', label: 'Sin especificar' },
                      { value: '1', label: 'Estrato 1' },
                      { value: '2', label: 'Estrato 2' },
                      { value: '3', label: 'Estrato 3' },
                      { value: '4', label: 'Estrato 4' },
                      { value: '5', label: 'Estrato 5' },
                      { value: '6', label: 'Estrato 6' }
                    ].map((stratum) => (
                      <div
                        key={stratum.value}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleStratumToggle(stratum.value)}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.stratum.includes(stratum.value) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{stratum.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Antigüedad</label>
            <div className="relative antiquity-dropdown">
              <Button
                variant="outline"
                onClick={() => setAntiquityDropdownOpen(!antiquityDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.antiquity.length === 0
                    ? "Cualquiera..."
                    : filters.antiquity.length === 1
                    ? filters.antiquity[0] === 'unspecified' ? 'Sin especificar' :
                      filters.antiquity[0] === '0-1' ? 'Menos de 1 año' :
                      filters.antiquity[0] === '1-8' ? '1 a 8 años' :
                      filters.antiquity[0] === '9-15' ? '9 a 15 años' :
                      filters.antiquity[0] === '16-30' ? '16 a 30 años' :
                      filters.antiquity[0] === '30+' ? 'Más de 30 años' : filters.antiquity[0]
                    : `${filters.antiquity.length} rangos seleccionados`
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
              {antiquityDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                  <div className="p-2 space-y-1">
                    {[
                      { value: 'unspecified', label: 'Sin especificar' },
                      { value: '0-1', label: 'Menos de 1 año' },
                      { value: '1-8', label: '1 a 8 años' },
                      { value: '9-15', label: '9 a 15 años' },
                      { value: '16-30', label: '16 a 30 años' },
                      { value: '30+', label: 'Más de 30 años' }
                    ].map((ant) => (
                      <div
                        key={ant.value}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => handleAntiquityToggle(ant.value)}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.antiquity.includes(ant.value) && (
                            <div className="w-2 h-2 bg-primary rounded" />
                          )}
                        </div>
                        <span className="text-sm">{ant.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Inmueble</label>
            <div className="relative property-type-dropdown">
              <Button
                variant="outline"
                onClick={() => setPropertyTypeDropdownOpen(!propertyTypeDropdownOpen)}
                className="w-full justify-between text-left font-normal h-10"
              >
                <span className="truncate">
                  {filters.property_type.length === 0
                    ? "Cualquiera..."
                    : filters.property_type.length === 1
                    ? filters.property_type[0].charAt(0).toUpperCase() + filters.property_type[0].slice(1)
                    : filters.property_type.map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(", ")
                  }
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
              
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
                        onClick={() => handlePropertyTypeToggle(type.value)}
                      >
                        <div className="w-4 h-4 border border-input rounded flex items-center justify-center">
                          {filters.property_type.includes(type.value) && (
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha Actualización (Desde)</label>
            <Input
              type="date"
              value={filters.updated_date_from}
              onChange={(e) => handleFilterChange('updated_date_from', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha Actualización (Hasta)</label>
            <Input
              type="date"
              value={filters.updated_date_to}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleFilterChange('updated_date_to', e.target.value)}
            />
          </div>

          {/* Filtros de ubicación */}
          <div className="lg:col-span-2 space-y-2">
            <label className="text-sm font-medium">Buscar por Dirección</label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Ej: Carrera 15 #45-67, Bogotá"
                value={filters.search_address}
                onChange={(e) => handleFilterChange('search_address', e.target.value)}
                disabled={geocoding}
              />
              {geocoding && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground">Busca propiedades cercanas a esta dirección</p>
              {currentCoordinates && (
                <div className="space-y-1">
                  <p className="text-green-600 font-medium">
                    ✓ Coordenadas obtenidas: {currentCoordinates.lat.toFixed(4)}, {currentCoordinates.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          </div>


          <div className="space-y-2">
            <label className="text-sm font-medium">Radio de Búsqueda (metros)</label>
            <Input
              type="number"
              value={filters.radius || ''}
              onChange={(e) => handleFilterChange('radius', e.target.value)}
              placeholder="Ej: 1000, 2500, 5000..."
              disabled={!filters.search_address}
              min="100"
              max="50000"
              step="100"
            />
            <p className="text-xs text-muted-foreground">
              {!filters.search_address 
                ? 'Requiere dirección para activar búsqueda por proximidad'
                : 'Distancia máxima desde la dirección ingresada'
              }
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col md:flex-row gap-3 md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleSearch} 
                className="w-full md:w-auto md:min-w-[120px]" 
                disabled={geocoding || loading}
              >
                <Search className="h-4 w-4 mr-2" />
                {geocoding ? 'Geocodificando...' : 'Buscar'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{geocoding ? 'Obteniendo coordenadas de la dirección...' : 'Aplicar filtros y buscar propiedades'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={handleClearFilters} className="w-full md:w-auto md:min-w-[120px] flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Limpiar Filtros
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Limpiar todos los filtros y mostrar todas las propiedades</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={handleExportToExcel}
                disabled={!data || data.pagination.total_count === 0}
                className="w-full md:w-auto md:min-w-[180px] flex items-center justify-center gap-2 text-sm"
                data-export-btn
              >
                <Download className="h-4 w-4" />
                Enviar Excel por Email
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enviar todas las propiedades de la consulta actual por email en formato Excel</p>
              {data && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {data.pagination.total_count.toLocaleString()} propiedades
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Tabla de propiedades */}
        <div className="border rounded-lg w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full table-auto" style={{minWidth: '1400px'}}>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px]">ID</TableHead>
                <TableHead className="min-w-[100px]">Ciudad</TableHead>
                <TableHead className="min-w-[70px]">Tipo</TableHead>
                <TableHead className="min-w-[80px]">Área (m²)</TableHead>
                <TableHead className="min-w-[90px]">Habitaciones</TableHead>
                <TableHead className="min-w-[60px]">Baños</TableHead>
                <TableHead className="min-w-[70px]">Garajes</TableHead>
                <TableHead className="min-w-[70px]">Estrato</TableHead>
                <TableHead className="min-w-[90px]">Antigüedad</TableHead>
                <TableHead className="min-w-[120px]">Precio</TableHead>
                <TableHead className="min-w-[100px]">Distancia (m)</TableHead>
                <TableHead className="min-w-[80px]">FincaRaiz</TableHead>
                <TableHead className="min-w-[80px]">Ubicación</TableHead>
                <TableHead className="min-w-[140px]">Fecha Actualización</TableHead>
                <TableHead className="min-w-[120px]">Fecha Creación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8">
                    Cargando propiedades...
                  </TableCell>
                </TableRow>
              ) : data?.properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                    No se encontraron propiedades con los filtros aplicados
                  </TableCell>
                </TableRow>
              ) : (
                data?.properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="text-sm">{property.id}</TableCell>
                    <TableCell>{property.city}</TableCell>
                    <TableCell>
                      <Badge variant={property.offer_type === 'Venta' ? 'default' : 'secondary'}>
                        {property.offer_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{property.area?.toLocaleString() || 'N/A'}</TableCell>
                    <TableCell>{property.rooms || 'Sin especificar'}</TableCell>
                    <TableCell>{property.baths || 'Sin especificar'}</TableCell>
                    <TableCell>{property.garages || 'Sin especificar'}</TableCell>
                    <TableCell>{property.stratum || 'Sin especificar'}</TableCell>
                    <TableCell>{property.antiquity || 'Sin especificar'}</TableCell>
                    <TableCell className="font-medium">
                      {property.price ? formatPrice(property.price) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {property.distance !== null && property.distance !== undefined ? `${Math.round(property.distance)} m` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {property.finca_raiz_link ? (
                        <a
                          href={property.finca_raiz_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {property.maps_link ? (
                        <a
                          href={property.maps_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-green-600 hover:text-green-800"
                        >
                          <MapPin className="h-4 w-4" />
                          Maps
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>{property.last_update || 'Sin especificar'}</TableCell>
                    <TableCell>{formatDate(property.creation_date)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </div>

        {/* Paginación */}
        {data?.pagination && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {((data.pagination.page - 1) * data.pagination.limit) + 1} a {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total_count)} de {data.pagination.total_count.toLocaleString()} propiedades
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!data.pagination.has_prev || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                <span className="text-sm">
                  Página {data.pagination.page} de {data.pagination.total_pages}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!data.pagination.has_next || loading}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

  </>
  )
}
