"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calculator, DollarSign, Home, MapPin, Search, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useGeocoding } from "@/hooks/use-geocoding"

interface PropertyData {
  area: number;
  rooms: number;
  baths: number;
  garages: number;
  stratum: number;
  latitude: number;
  longitude: number;
  antiquity: number;
  is_new: string;
  area_per_room: number;
  age_bucket: string;
  has_garage: number;
  city_id: string;
  property_type: number;
}

interface ValuationForm {
  propertyData: PropertyData;
  valuationName: string; // Nuevo campo para el nombre del avalúo
}

interface ValuationResult {
  rent_price_per_sqm?: number;
  sell_price_per_sqm?: number;
  total_rent_price?: number;
  total_sell_price?: number;
  rent_error?: string;
  sell_error?: string;
  // Nuevos campos para cálculos detallados
  capitalization_rate?: number;
  rent_annual_price?: number;
  capitalized_value?: number;
  average_valuation?: number;
}

export function PropertyValuation() {
  const [formData, setFormData] = useState<PropertyData>({
    area: undefined as any,
    rooms: undefined as any, // Puede ser 0
    baths: undefined as any, // Puede ser 0
    garages: undefined as any, // Puede ser 0
    stratum: undefined as any,
    latitude: undefined as any,
    longitude: undefined as any,
    antiquity: undefined as any, // Puede ser 0
    is_new: "no",
    area_per_room: 0,
    age_bucket: "",
    has_garage: 0,
    city_id: "1",
    property_type: undefined as any
  })
  
  const [valuationName, setValuationName] = useState<string>("")
  
  const [results, setResults] = useState<ValuationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [address, setAddress] = useState("")
  const { geocoding, lastGeocodedAddress, currentCoordinates, geocodeAddress, clearCoordinates } = useGeocoding()
  const [capitalizationRate, setCapitalizationRate] = useState('') // Sin valor por defecto

  const handleSaveValuation = async () => {
    if (!results || !valuationName.trim()) return
    
    setSaving(true)
    
    try {
      // Calcular el valor capitalizado si hay renta y tasa
      let capitalizedRentValue = results.total_rent_price
      if (results.total_rent_price && capitalizationRate && parseFloat(capitalizationRate) > 0) {
        const monthlyRent = results.total_rent_price
        const capRate = parseFloat(capitalizationRate)
        capitalizedRentValue = monthlyRent / (capRate / 100)
      }

      const valuationData = {
        valuation_name: valuationName.trim(),
        area: formData.area,
        property_type: formData.property_type,
        rooms: formData.rooms,
        baths: formData.baths,
        garages: formData.garages,
        stratum: formData.stratum,
        antiquity: formData.antiquity,
        latitude: formData.latitude,
        longitude: formData.longitude,
        capitalization_rate: capitalizationRate ? parseFloat(capitalizationRate) : null,
        sell_price_per_sqm: results.sell_price_per_sqm,
        rent_price_per_sqm: results.rent_price_per_sqm,
        total_sell_price: results.total_sell_price,
        total_rent_price: capitalizedRentValue, // Ahora guarda el valor capitalizado
        final_price: results.average_valuation || results.capitalized_value || results.total_sell_price
      }

      // Usar variable de entorno para la URL del backend, con fallback para desarrollo
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      const response = await fetch(`${backendUrl}/api/save-valuation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(valuationData)
      })

      if (response.ok) {
        const result = await response.json()
        setSaveMessage({
          type: 'success',
          text: `✅ ${result.message || 'Avalúo guardado exitosamente'}`
        })
        // Limpiar mensaje después de 5 segundos
        setTimeout(() => setSaveMessage(null), 5000)
      } else {
        const errorData = await response.json()
        setSaveMessage({
          type: 'error',
          text: `❌ ${errorData.message || 'Error al guardar avalúo'}`
        })
        // Limpiar mensaje después de 5 segundos
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: '❌ Error de conexión al guardar avalúo'
      })
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setSaving(false)
    }
  }
  
  const propertyTypes = [
    { value: 1, label: "Apartamento" },
    { value: 2, label: "Casa" },
    { value: 3, label: "Oficina" },
    { value: 4, label: "Local" },
    { value: 5, label: "Bodega" },
    { value: 6, label: "Lote" },
    { value: 7, label: "Estudio" },
    { value: 8, label: "Penthouse" },
    { value: 9, label: "Duplex" },
    { value: 0, label: "Otro" }
  ]
  
  const stratums = [1, 2, 3, 4, 5, 6]

  const handleInputChange = (field: keyof PropertyData, value: any) => {
    const updatedData = { ...formData, [field]: value }
    
    // Actualizar area_per_room cuando cambien area o rooms
    if (field === 'area' || field === 'rooms') {
      if (updatedData.rooms > 0 && updatedData.area > 0) {
        updatedData.area_per_room = Number((updatedData.area / updatedData.rooms).toFixed(2))
      } else {
        updatedData.area_per_room = 0
      }
    }
    
    // Actualizar has_garage cuando cambien garages
    if (field === 'garages') {
      updatedData.has_garage = value > 0 ? 1 : 0
    }
    
    // Actualizar age_bucket cuando cambie antiquity
    if (field === 'antiquity') {
      const years = Number(value)
      if (years < 1) updatedData.age_bucket = "0-1"
      else if (years <= 8) updatedData.age_bucket = "1-8"
      else if (years <= 15) updatedData.age_bucket = "9-15"
      else if (years <= 30) updatedData.age_bucket = "16-30"
      else updatedData.age_bucket = "30+"
    }
    
    setFormData(updatedData)
  }

  const handleGeocodeAddress = async () => {
    if (!address || address.trim() === '' || geocoding) return
    
    try {
      // Siempre geocodificar, no usar cache en el componente de avalúo
      const geocodeResult = await geocodeAddress(`${address}, Colombia`)
      
      if (geocodeResult.success) {
        setFormData(prev => ({
          ...prev,
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude
        }))
      } else {
        alert(`Error: ${geocodeResult.error}`)
      }
    } catch (error) {
      alert('Error al obtener coordenadas de la dirección')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar nombre del avalúo
    if (!valuationName.trim()) {
      const nameInput = document.getElementById('valuation_name') as HTMLInputElement
      if (nameInput) {
        nameInput.focus()
        nameInput.reportValidity()
      }
      return
    }
    
    // Validar campos de Select usando inputs ocultos para HTML5 validation
    const propertyTypeInput = document.getElementById('property_type_hidden') as HTMLInputElement
    const stratumInput = document.getElementById('stratum_hidden') as HTMLInputElement
    
    if (propertyTypeInput && (!formData.property_type || formData.property_type === 0)) {
      propertyTypeInput.focus()
      propertyTypeInput.reportValidity()
      return
    }
    
    if (stratumInput && (!formData.stratum || formData.stratum === 0)) {
      stratumInput.focus()
      stratumInput.reportValidity()
      return
    }
    
    setLoading(true)
    
    try {
      // Preparar datos convirtiendo undefined a 0 donde sea necesario
      const dataToSend = {
        ...formData,
        area: formData.area || 0,
        rooms: formData.rooms !== undefined ? formData.rooms : 0,
        baths: formData.baths !== undefined ? formData.baths : 0,
        garages: formData.garages !== undefined ? formData.garages : 0,
        stratum: formData.stratum || 0,
        latitude: formData.latitude || 0,
        longitude: formData.longitude || 0,
        antiquity: formData.antiquity !== undefined ? formData.antiquity : 0,
        property_type: formData.property_type || 0
      }
      
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${API_BASE_URL}/api/property-valuation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        const apiResults = data.data.valuation_results
        
        // Realizar cálculos adicionales
        let enhancedResults = { ...apiResults }
        
        // Si hay precio de renta, calcular valor capitalizado
        if (apiResults.rent_price_per_sqm && !apiResults.rent_error) {
          const monthlyRent = apiResults.total_rent_price
          const capRate = Number(capitalizationRate)
          // Para tasa mensual, se divide la renta mensual por la tasa mensual
          const capitalizedValue = monthlyRent / (capRate / 100)
          const annualRent = monthlyRent * 12
          
          enhancedResults.capitalization_rate = capRate
          enhancedResults.rent_annual_price = annualRent
          enhancedResults.capitalized_value = capitalizedValue
          
          // Si también hay precio de venta, calcular promedio
          if (apiResults.sell_price_per_sqm && !apiResults.sell_error) {
            const averageValuation = (apiResults.total_sell_price + capitalizedValue) / 2
            enhancedResults.average_valuation = averageValuation
          }
        }
        
        setResults(enhancedResults)
      } else {
        console.error('Error:', data.message)
      }
    } catch (error) {
      console.error('Error realizando avalúo:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Avalúo de Propiedades</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Datos de la Propiedad
            </CardTitle>
            <CardDescription>
              Ingrese los datos de la propiedad para obtener el avalúo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    min="1"
                    placeholder="Ej: 80"
                    value={formData.area || ''}
                    onChange={(e) => handleInputChange('area', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Label htmlFor="property_type">Tipo de Propiedad *</Label>
                  <Select
                    value={formData.property_type ? formData.property_type.toString() : ""}
                    onValueChange={(value) => handleInputChange('property_type', Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione el tipo de propiedad" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value.toString()}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Input oculto para validación HTML5 */}
                  <input
                    id="property_type_hidden"
                    type="text"
                    value={formData.property_type || ''}
                    required
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0, 
                      pointerEvents: 'none',
                      zIndex: -1
                    }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="rooms">Habitaciones</Label>
                  <Input
                    id="rooms"
                    type="number"
                    min="0"
                    placeholder="Ej: 3"
                    value={formData.rooms !== undefined && formData.rooms !== null ? formData.rooms.toString() : ''}
                    onChange={(e) => handleInputChange('rooms', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="baths">Baños</Label>
                  <Input
                    id="baths"
                    type="number"
                    min="0"
                    placeholder="Ej: 2"
                    value={formData.baths !== undefined && formData.baths !== null ? formData.baths.toString() : ''}
                    onChange={(e) => handleInputChange('baths', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="garajes">Garajes</Label>
                  <Input
                    id="garajes"
                    type="number"
                    min="0"
                    placeholder="Ej: 1"
                    value={formData.garages !== undefined && formData.garages !== null ? formData.garages.toString() : ''}
                    onChange={(e) => handleInputChange('garages', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div style={{ position: 'relative' }}>
                  <Label htmlFor="stratum">Estrato *</Label>
                  <Select
                    value={formData.stratum ? formData.stratum.toString() : ""}
                    onValueChange={(value) => handleInputChange('stratum', Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione el estrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {stratums.map((stratum) => (
                        <SelectItem key={stratum} value={stratum.toString()}>
                          Estrato {stratum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Input oculto para validación HTML5 */}
                  <input
                    id="stratum_hidden"
                    type="text"
                    value={formData.stratum || ''}
                    required
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0, 
                      pointerEvents: 'none',
                      zIndex: -1
                    }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                </div>
                <div>
                  <Label htmlFor="antiquity">Antigüedad (años)</Label>
                  <Input
                    id="antiquity"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ej: 5"
                    value={formData.antiquity !== undefined && formData.antiquity !== null ? formData.antiquity.toString() : ''}
                    onChange={(e) => handleInputChange('antiquity', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                  />
                  {formData.age_bucket && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Rango detectado: {formData.age_bucket}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="valuation_name">Nombre del Avalúo</Label>
                <Input
                  id="valuation_name"
                  value={valuationName}
                  onChange={(e) => setValuationName(e.target.value)}
                  placeholder="Ej: Apartamento Chicó Norte - Cliente ABC"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Buscar por Dirección</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="address"
                      type="text"
                      placeholder="Ej: Carrera 15 #45-67, Bogotá"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={geocoding}
                    />
                    {geocoding && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleGeocodeAddress}
                    disabled={geocoding || !address.trim()}
                    className="shrink-0"
                    title="Buscar coordenadas"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ingrese una dirección para obtener automáticamente las coordenadas
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitud</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    placeholder="Ej: 4.680479"
                    value={formData.latitude || ''}
                    onChange={(e) => handleInputChange('latitude', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                    className={lastGeocodedAddress ? "bg-green-50 border-green-200" : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitud</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    placeholder="Ej: -74.047485"
                    value={formData.longitude || ''}
                    onChange={(e) => handleInputChange('longitude', e.target.value === '' ? undefined : Number(e.target.value))}
                    onFocus={(e) => { if (e.target.value === '0') e.target.select() }}
                    required
                    className={lastGeocodedAddress ? "bg-green-50 border-green-200" : ""}
                  />
                </div>
              </div>
              
              {lastGeocodedAddress && currentCoordinates && (
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                  ✓ Coordenadas obtenidas de: {lastGeocodedAddress}
                  <br />
                  <span className="text-xs text-gray-600">
                    Lat: {currentCoordinates.lat.toFixed(4)}, Lng: {currentCoordinates.lng.toFixed(4)}
                  </span>
                </div>
              )}

              <div>
                <Label htmlFor="capitalization_rate">Tasa de Capitalización Mensual (%)</Label>
                <Input
                  id="capitalization_rate"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  placeholder="Ej: 0.5"
                  value={capitalizationRate}
                  onChange={(e) => setCapitalizationRate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tasa mensual usada para capitalizar el arriendo y estimar valor por renta (típicamente 0.5% - 1.5%)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Calculando avalúo..." : "Calcular Avalúo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resultados del Avalúo
            </CardTitle>
            <CardDescription>
              Valoración estimada por modelos de machine learning
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-6">
                {/* Resumen Final */}
                {results.average_valuation && (
                  <div className="p-6 border-2 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                    <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2 text-lg">
                      <Calculator className="h-5 w-5" />
                      Avalúo Promedio Final
                    </h3>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-900 mb-2">
                        {formatCurrency(results.average_valuation)}
                      </div>
                      <p className="text-sm text-purple-600">
                        Promedio entre valoración por venta y por renta capitalizada
                      </p>
                    </div>
                  </div>
                )}

                {/* Metodología por Venta */}
                {results.sell_price_per_sqm && !results.sell_error ? (
                  <div className="p-4 border rounded-lg bg-green-50">
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Metodología por Venta
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Precio por m² (modelo ML):</span>
                        <Badge variant="secondary">{formatCurrency(results.sell_price_per_sqm)}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Área de la propiedad:</span>
                        <span>{formData.area} m²</span>
                      </div>
                      <hr className="border-green-200" />
                      <div className="flex justify-between font-semibold">
                        <span>Valor Total por Venta:</span>
                        <Badge className="bg-green-600 text-white">{formatCurrency(results.total_sell_price!)}</Badge>
                      </div>
                      <p className="text-xs text-green-700 mt-2">
                        Cálculo: {formatCurrency(results.sell_price_per_sqm)} × {formData.area} m²
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg bg-red-50">
                    <h3 className="font-semibold text-red-800 mb-2">Metodología por Venta</h3>
                    <p className="text-red-600 text-sm">
                      {results.sell_error || "Modelo no disponible"}
                    </p>
                  </div>
                )}

                {/* Metodología por Renta Capitalizada */}
                {results.rent_price_per_sqm && !results.rent_error ? (
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Metodología por Renta Capitalizada
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Precio por m² (modelo ML):</span>
                        <Badge variant="secondary">{formatCurrency(results.rent_price_per_sqm)}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Renta mensual total:</span>
                        <Badge variant="outline">{formatCurrency(results.total_rent_price!)}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Renta anual:</span>
                        <Badge variant="outline">{formatCurrency(results.rent_annual_price!)}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tasa de capitalización mensual:</span>
                        <span>{results.capitalization_rate}%</span>
                      </div>
                      <hr className="border-blue-200" />
                      <div className="flex justify-between font-semibold">
                        <span>Valor Capitalizado:</span>
                        <Badge className="bg-blue-600 text-white">{formatCurrency(results.capitalized_value!)}</Badge>
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        Cálculo: {formatCurrency(results.total_rent_price!)} ÷ {results.capitalization_rate}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg bg-red-50">
                    <h3 className="font-semibold text-red-800 mb-2">Metodología por Renta Capitalizada</h3>
                    <p className="text-red-600 text-sm">
                      {results.rent_error || "Modelo no disponible"}
                    </p>
                  </div>
                )}

                {/* Mensaje de estado de guardado */}
                {saveMessage && (
                  <div className={`p-3 rounded-lg text-center font-medium ${
                    saveMessage.type === 'success' 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {saveMessage.text}
                  </div>
                )}

                {/* Botón para guardar avalúo - más grande */}
                <div className="flex justify-center pt-4">
                  <Button
                    type="button"
                    onClick={handleSaveValuation}
                    disabled={saving || !valuationName.trim()}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {saving ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? 'Guardando...' : 'Guardar Avalúo'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Complete el formulario para obtener el avalúo</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}