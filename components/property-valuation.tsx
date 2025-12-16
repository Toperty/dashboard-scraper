"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, DollarSign, Home, MapPin, Search, Save, ChevronLeft, ChevronRight, History, Edit, Trash2, FileText, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useGeocoding } from "@/hooks/use-geocoding"
import { useConfirm } from "@/hooks/use-confirm"
import { fetchValuations, deleteValuation, type Valuation, type ValuationsResponse } from "@/lib/api"

interface PropertyData {
  area: number | undefined;
  rooms: number;
  baths: number;
  garages: number;
  stratum: number | undefined;
  latitude: number;
  longitude: number;
  antiquity: number | undefined;
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
  rent_monthly_total?: number;
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
  const { geocoding, lastGeocodedAddress, currentCoordinates, geocodeAddress, reverseGeocode, clearCoordinates } = useGeocoding()
  const { confirm } = useConfirm()
  const [capitalizationRate, setCapitalizationRate] = useState('') // Sin valor por defecto
  const [editableFinalPrice, setEditableFinalPrice] = useState<string>('')
  const [lastSavedValuation, setLastSavedValuation] = useState<string | null>(null)
  
  // Estado para la tabla de avalúos
  const [valuationsData, setValuationsData] = useState<ValuationsResponse | null>(null)
  const [valuationsLoading, setValuationsLoading] = useState(true)
  const [currentValuationsPage, setCurrentValuationsPage] = useState(1)
  
  // Estado para el formulario de plan de pagos
  const [showPaymentPlanForm, setShowPaymentPlanForm] = useState(false)
  const [selectedValuation, setSelectedValuation] = useState<Valuation | null>(null)
  const [paymentPlanData, setPaymentPlanData] = useState({
    // Flujo Toperty Interno
    area: '',
    commercial_value: '',
    average_purchase_value: '',
    asking_price: '',
    user_down_payment: '',
    program_months: '',
    potential_down_payment: '',
    bank_mortgage_rate: '',
    dupla_bank_rate: '',
    // Para Envío Usuario
    client_name: '',
    address: '',
    city: '',
    country: 'Colombia',
    construction_year: '',
    stratum: '',
    apartment_type: '',
    private_parking: ''
  })


  const loadValuations = useCallback(async () => {
    try {
      setValuationsLoading(true)
      const data = await fetchValuations(currentValuationsPage, 10)
      setValuationsData(data)
    } catch (error) {
      console.error('Error loading valuations:', error)
      setValuationsData({
        valuations: [],
        pagination: {
          page: 1,
          limit: 10,
          total_count: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      })
    } finally {
      setValuationsLoading(false)
    }
  }, [currentValuationsPage])

  // Cargar avalúos al montar el componente
  useEffect(() => {
    loadValuations()
  }, [loadValuations])

  const handleValuationsPageChange = (newPage: number) => {
    setCurrentValuationsPage(newPage)
  }

  const handleEditValuation = (valuation: Valuation) => {
    // Cargar los datos del avalúo en el formulario
    setFormData({
      area: valuation.area,
      property_type: valuation.property_type,
      rooms: valuation.rooms,
      baths: valuation.baths,
      garages: valuation.garages,
      stratum: valuation.stratum,
      antiquity: (() => {
        // Convertir años guardados a valor de rango (1-5)
        const years = valuation.antiquity
        if (years < 1) return 1  // "0-1 años"
        else if (years <= 8) return 2  // "1-8 años"
        else if (years <= 15) return 3  // "9-15 años"
        else if (years <= 30) return 4  // "16-30 años"
        else return 5  // "Más de 30 años"
      })(),
      latitude: valuation.latitude,
      longitude: valuation.longitude,
      area_per_room: valuation.rooms > 0 ? Number((valuation.area / valuation.rooms).toFixed(2)) : 0,
      has_garage: valuation.garages > 0 ? 1 : 0,
      age_bucket: (() => {
        const years = valuation.antiquity
        if (years < 1) return "0-1"
        else if (years <= 8) return "1-8"
        else if (years <= 15) return "9-15"
        else if (years <= 30) return "16-30"
        else return "30+"
      })(),
      is_new: "no",  // Valor por defecto
      city_id: "1"   // Valor por defecto
    })
    
    setValuationName(valuation.valuation_name)
    setCapitalizationRate(valuation.capitalization_rate?.toString() || '')
    setEditableFinalPrice(valuation.final_price?.toString() || '')
    
    // Crear resultados replicando exactamente los cálculos originales
    const calculatedResults: any = {
      sell_price_per_sqm: valuation.sell_price_per_sqm || 0,
      rent_price_per_sqm: valuation.rent_price_per_sqm || 0,
      total_sell_price: valuation.total_sell_price || 0,
      total_rent_price: valuation.total_rent_price || 0,
      average_valuation: valuation.final_price || 0
    }
    
    // Calcular valores correctos desde los datos guardados
    if (valuation.rent_price_per_sqm) {
      // Renta mensual total = precio por m² × área (esta es la renta mensual real)
      const monthlyRentTotal = valuation.rent_price_per_sqm * valuation.area
      // Renta anual = renta mensual × 12
      const annualRent = monthlyRentTotal * 12
      
      // Agregar el valor de renta mensual total que faltaba
      calculatedResults.rent_monthly_total = monthlyRentTotal
      calculatedResults.rent_annual_price = annualRent
      
      if (valuation.capitalization_rate) {
        const capRate = valuation.capitalization_rate
        // total_rent_price guardado es el valor capitalizado
        const capitalizedValue = valuation.total_rent_price || (monthlyRentTotal / (capRate / 100))
        
        calculatedResults.capitalization_rate = capRate
        calculatedResults.capitalized_value = capitalizedValue
        // Mantener el total_rent_price como el valor capitalizado guardado
        calculatedResults.total_rent_price = capitalizedValue
        
        // Si también hay precio de venta, calcular promedio
        if (valuation.sell_price_per_sqm && valuation.total_sell_price) {
          const averageValuation = (valuation.total_sell_price + capitalizedValue) / 2
          calculatedResults.average_valuation = averageValuation
        }
      }
    }
    
    setResults(calculatedResults)
    setLastSavedValuation(null)
    
    // Scroll hacia arriba para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Función para resetear el formulario
  const resetForm = () => {
    setFormData({
      area: undefined,
      rooms: 0,
      baths: 0,
      garages: 0,
      stratum: undefined,
      antiquity: undefined,
      latitude: 0,
      longitude: 0,
      area_per_room: 0,
      has_garage: 0,
      age_bucket: "",
      is_new: "no",
      city_id: "1",
      property_type: undefined as any
    })
    setValuationName("")
    setResults(null)
    setAddress("")
    setCapitalizationRate("")
    setEditableFinalPrice("")
    setSaveMessage(null)
  }

  const handlePaymentPlan = async (valuation: Valuation) => {
    // Preparar datos del formulario con información del avalúo
    setSelectedValuation(valuation)
    
    // Obtener dirección y ciudad desde coordenadas si están disponibles
    let resolvedAddress = address || '' // Usar la dirección del formulario actual si está disponible
    let resolvedCity = ''
    let resolvedCountry = 'Colombia'
    
    if (valuation.latitude && valuation.longitude && !address) {
      try {
        const result = await reverseGeocode(valuation.latitude, valuation.longitude)
        if (result.success) {
          resolvedAddress = result.formatted_address
          resolvedCity = result.city || ''
          resolvedCountry = result.country || 'Colombia'
        }
      } catch (error) {
        console.log('No se pudo obtener la dirección automáticamente')
      }
    }
    
    setPaymentPlanData({
      // Flujo Toperty Interno - algunos valores del avalúo
      area: valuation.area.toString(),
      commercial_value: valuation.final_price?.toString() || '',
      average_purchase_value: '',
      asking_price: '',
      user_down_payment: '',
      program_months: '',
      potential_down_payment: '',
      bank_mortgage_rate: '',
      dupla_bank_rate: '',
      // Para Envío Usuario - llenar con datos disponibles del avalúo
      client_name: '',
      address: resolvedAddress,
      city: resolvedCity,
      country: resolvedCountry,
      construction_year: '',
      stratum: valuation.stratum?.toString() || '',
      apartment_type: '',
      private_parking: valuation.garages?.toString() || ''
    })
    setShowPaymentPlanForm(true)
  }

  // Función para formatear valores de entrada como moneda (redondeado)
  const formatInputValue = (value: string) => {
    if (!value) return ''
    // Solo limpiar y formatear lo que ya está guardado, no lo que se está escribiendo
    const numericValue = parseInt(value.replace(/[^0-9]/g, ''))
    if (isNaN(numericValue)) return ''
    return numericValue.toLocaleString('es-CO')
  }

  // Función para convertir valor formateado a número
  const parseFormattedValue = (value: string) => {
    // Solo mantener números
    return value.replace(/[^0-9]/g, '')
  }

  const handlePaymentPlanChange = (field: string, value: string) => {
    const priceFields = ['average_purchase_value', 'asking_price', 'user_down_payment', 'potential_down_payment']
    
    if (priceFields.includes(field)) {
      setPaymentPlanData(prev => ({
        ...prev,
        [field]: parseFormattedValue(value)
      }))
    } else if (field === 'commercial_value') {
      // Para commercial_value, permitir texto temporal mientras se edita
      const cleanValue = value.replace(/[^0-9]/g, '')
      setPaymentPlanData(prev => ({
        ...prev,
        [field]: cleanValue
      }))
    } else {
      setPaymentPlanData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handlePaymentPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implementar envío a Google Sheets
    console.log('Datos del plan de pagos:', {
      valuation: selectedValuation?.valuation_name,
      data: paymentPlanData
    })
    
    // Por ahora solo cerrar el formulario
    setShowPaymentPlanForm(false)
    setSelectedValuation(null)
  }

  const handleClosePaymentPlanForm = () => {
    setShowPaymentPlanForm(false)
    setSelectedValuation(null)
    setPaymentPlanData({
      // Flujo Toperty Interno
      area: '',
      commercial_value: '',
      average_purchase_value: '',
      asking_price: '',
      user_down_payment: '',
      program_months: '',
      potential_down_payment: '',
      bank_mortgage_rate: '',
      dupla_bank_rate: '',
      // Para Envío Usuario
      client_name: '',
      address: '',
      city: '',
      country: 'Colombia',
      construction_year: '',
      stratum: '',
      apartment_type: '',
      private_parking: ''
    })
  }

  const handleDeleteValuation = async (valuation: Valuation) => {
    const result = await confirm(
      `Esta acción eliminará permanentemente el avalúo "${valuation.valuation_name}". Esta acción no se puede deshacer.`,
      "¿Eliminar avalúo?"
    )
    
    if (result.confirmed) {
      try {
        const deleteResult = await deleteValuation(valuation.id)
        
        if (deleteResult.status === 'success') {
          setSaveMessage({
            type: 'success',
            text: `✅ ${deleteResult.message}`
          })
          loadValuations() // Recargar la tabla
        } else {
          setSaveMessage({
            type: 'error',
            text: `❌ ${deleteResult.message}`
          })
        }
        
        setTimeout(() => setSaveMessage(null), 5000)
      } catch (error) {
        setSaveMessage({
          type: 'error',
          text: '❌ Error eliminando avalúo'
        })
        setTimeout(() => setSaveMessage(null), 5000)
      }
    }
  }

  const handleSaveValuation = async () => {
    if (!results || !valuationName.trim()) return
    
    // Prevenir múltiples ejecuciones
    if (saving) return
    
    setSaving(true)
    
    try {
      // Calcular el valor capitalizado si hay renta y tasa
      let capitalizedRentValue = results.total_rent_price
      if (results.total_rent_price && capitalizationRate && parseFloat(capitalizationRate) > 0) {
        const monthlyRent = results.total_rent_price
        const capRate = parseFloat(capitalizationRate)
        capitalizedRentValue = monthlyRent / (capRate / 100)
      }

      // Usar el valor final editado si existe, sino usar el calculado
      const finalPriceForSave = editableFinalPrice && parseFloat(editableFinalPrice) > 0 
        ? parseFloat(editableFinalPrice) 
        : (results.average_valuation || results.capitalized_value || results.total_sell_price)

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
        final_price: finalPriceForSave
      }

      // Usar variable de entorno para la URL del backend, con fallback para desarrollo
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      const response = await fetch(`${backendUrl}/api/save-valuation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...valuationData,
          // Enviar flag para verificar duplicados en el backend
          check_duplicates: true
        })
      })

      const result = await response.json()
      
      if (result.status === 'success') {
        setSaveMessage({
          type: 'success',
          text: `✅ ${result.message}`
        })
        // Recargar la tabla de avalúos
        loadValuations()
        
        // Si fue creación, limpiar el formulario para el siguiente avalúo
        if (result.action === 'created') {
          resetForm()
        }
      } else {
        setSaveMessage({
          type: 'error',
          text: `❌ ${result.message}`
        })
      }
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setSaveMessage(null), 5000)
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

  const antiquityRanges = [
    { value: 1, label: "0-1 años", bucket: "0-1" },
    { value: 2, label: "1-8 años", bucket: "1-8" },
    { value: 3, label: "9-15 años", bucket: "9-15" },
    { value: 4, label: "16-30 años", bucket: "16-30" },
    { value: 5, label: "Más de 30 años", bucket: "30+" }
  ]
  
  const stratums = [1, 2, 3, 4, 5, 6]

  const handleInputChange = (field: keyof PropertyData, value: any) => {
    const updatedData = { ...formData, [field]: value }
    
    // Limpiar hash de avalúo guardado cuando cambien datos relevantes
    setLastSavedValuation(null)
    
    // Actualizar area_per_room cuando cambien area o rooms
    if (field === 'area' || field === 'rooms') {
      if (updatedData.rooms > 0 && updatedData.area && updatedData.area > 0) {
        updatedData.area_per_room = Number((updatedData.area / updatedData.rooms).toFixed(2))
      } else {
        updatedData.area_per_room = 0
      }
    }
    
    // Actualizar has_garage cuando cambien garages
    if (field === 'garages') {
      updatedData.has_garage = value > 0 ? 1 : 0
    }
    
    // Actualizar age_bucket cuando cambie antiquity (ahora antiquity es el valor del rango)
    if (field === 'antiquity') {
      const selectedRange = antiquityRanges.find(range => range.value === Number(value))
      if (selectedRange) {
        updatedData.age_bucket = selectedRange.bucket
      }
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

  const handleCalculateValuation = async () => {
    // Limpiar resultados anteriores primero
    setResults(null)
    
    // Validar campos requeridos para el cálculo
    
    // Validar área
    if (!formData.area || formData.area <= 0) {
      const areaInput = document.getElementById('area') as HTMLInputElement
      if (areaInput) {
        areaInput.focus()
        areaInput.reportValidity()
      }
      return
    }
    
    // Validar habitaciones
    if (formData.rooms === undefined || formData.rooms < 0) {
      const roomsInput = document.getElementById('rooms') as HTMLInputElement
      if (roomsInput) {
        roomsInput.focus()
        roomsInput.reportValidity()
      }
      return
    }
    
    // Validar baños
    if (formData.baths === undefined || formData.baths < 0) {
      const bathsInput = document.getElementById('baths') as HTMLInputElement
      if (bathsInput) {
        bathsInput.focus()
        bathsInput.reportValidity()
      }
      return
    }
    
    // Validar garajes
    if (formData.garages === undefined || formData.garages < 0) {
      const garagesInput = document.getElementById('garajes') as HTMLInputElement
      if (garagesInput) {
        garagesInput.focus()
        garagesInput.reportValidity()
      }
      return
    }
    
    // Validar coordenadas
    if (!formData.latitude || formData.latitude === 0 || !formData.longitude || formData.longitude === 0) {
      await confirm(
        'Por favor, obtenga las coordenadas usando el botón "Buscar Coordenadas" antes de calcular el avalúo.',
        "Coordenadas requeridas"
      )
      return
    }
    
    // Validar tipo de propiedad
    const propertyTypeInput = document.getElementById('property_type_hidden') as HTMLInputElement
    if (propertyTypeInput && (!formData.property_type || formData.property_type === 0)) {
      propertyTypeInput.focus()
      propertyTypeInput.reportValidity()
      return
    }
    
    // Validar estrato
    const stratumInput = document.getElementById('stratum_hidden') as HTMLInputElement
    if (stratumInput && (!formData.stratum || formData.stratum === 0)) {
      stratumInput.focus()
      stratumInput.reportValidity()
      return
    }
    
    // Validar antigüedad
    const antiquityInput = document.getElementById('antiquity_hidden') as HTMLInputElement
    if (antiquityInput && (!formData.antiquity || formData.antiquity === 0)) {
      antiquityInput.focus()
      antiquityInput.reportValidity()
      return
    }
    
    // Validar tasa de capitalización si se requiere para cálculo de renta
    if (!capitalizationRate || capitalizationRate.trim() === '' || parseFloat(capitalizationRate) <= 0) {
      const capRateInput = document.getElementById('capitalization_rate') as HTMLInputElement
      if (capRateInput) {
        capRateInput.focus()
      }
      await confirm(
        'Por favor, ingrese una tasa de capitalización válida (mayor a 0). Esta tasa es necesaria para calcular el valor por renta capitalizada.',
        "Tasa de capitalización requerida"
      )
      return
    }
    
    setLoading(true)
    
    try {
      // Preparar datos convirtiendo undefined a 0 y asegurando tipos correctos
      const dataToSend = {
        area: formData.area || 0,
        rooms: formData.rooms !== undefined ? formData.rooms : 0,
        baths: formData.baths !== undefined ? formData.baths : 0,
        garages: formData.garages !== undefined ? formData.garages : 0,
        stratum: formData.stratum || 0,
        latitude: formData.latitude || 0,
        longitude: formData.longitude || 0,
        antiquity: formData.antiquity !== undefined ? formData.antiquity : 0,
        property_type: formData.property_type || 0,
        // Asegurar que estos campos tengan el tipo correcto para el backend
        is_new: typeof formData.is_new === 'string' ? formData.is_new : (formData.is_new ? "si" : "no"),
        area_per_room: formData.area_per_room || 0,
        age_bucket: formData.age_bucket || "0-1",
        has_garage: formData.has_garage || 0,
        city_id: formData.city_id || "1"
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
          enhancedResults.rent_monthly_total = monthlyRent
          enhancedResults.rent_annual_price = annualRent
          enhancedResults.capitalized_value = capitalizedValue
          
          // Si también hay precio de venta, calcular promedio
          if (apiResults.sell_price_per_sqm && !apiResults.sell_error) {
            const averageValuation = (apiResults.total_sell_price + capitalizedValue) / 2
            enhancedResults.average_valuation = averageValuation
          }
        }
        
        setResults(enhancedResults)
        // Actualizar el valor final editable con el valor calculado
        const calculatedFinalPrice = enhancedResults.average_valuation || enhancedResults.capitalized_value || enhancedResults.total_sell_price
        if (calculatedFinalPrice) {
          setEditableFinalPrice(calculatedFinalPrice.toString())
        }
      } else {
        console.error('Error:', data.message)
      }
    } catch (error) {
      console.error('Error realizando avalúo:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // No hacer nada, el cálculo se maneja con botón separado
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="area" className="cursor-help">Área (m²)</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Área total construida de la propiedad en metros cuadrados</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="property_type" className="cursor-help">Tipo de Propiedad *</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clasificación del inmueble según su uso y características</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="rooms" className="cursor-help">Habitaciones</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Número total de habitaciones o alcobas de la propiedad</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="baths" className="cursor-help">Baños</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Número total de baños completos y medios baños</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="garajes" className="cursor-help">Garajes</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Número de espacios de parqueadero o garaje disponibles</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="stratum" className="cursor-help">Estrato *</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clasificación socioeconómica del sector donde se ubica la propiedad (1-6)</p>
                    </TooltipContent>
                  </Tooltip>
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
                <div style={{ position: 'relative' }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="antiquity" className="cursor-help">Antigüedad *</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rango de antigüedad de construcción de la propiedad</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={formData.antiquity ? formData.antiquity.toString() : ""}
                    onValueChange={(value) => handleInputChange('antiquity', Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione el rango de antigüedad" />
                    </SelectTrigger>
                    <SelectContent>
                      {antiquityRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value.toString()}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Input oculto para validación HTML5 */}
                  <input
                    id="antiquity_hidden"
                    type="text"
                    value={formData.antiquity || ''}
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

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="valuation_name" className="cursor-help">
                      Nombre del Avalúo
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Este nombre se usa para guardar e identificar el avalúo en el historial</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="valuation_name"
                  value={valuationName}
                  onChange={(e) => {
                    setValuationName(e.target.value)
                    setLastSavedValuation(null) // Limpiar hash cuando cambie el nombre
                  }}
                  placeholder="Ej: Apartamento Chicó Norte - Cliente ABC"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="address" className="cursor-help">Buscar por Dirección</Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ingrese la dirección para obtener automáticamente las coordenadas GPS</p>
                  </TooltipContent>
                </Tooltip>
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
                    className="shrink-0 transition-all duration-200 hover:scale-105 hover:shadow-md disabled:hover:scale-100 disabled:hover:shadow-none"
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="latitude" className="cursor-help">Latitud</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Coordenada geográfica que indica la posición norte-sur (se obtiene automáticamente)</p>
                    </TooltipContent>
                  </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="longitude" className="cursor-help">Longitud</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Coordenada geográfica que indica la posición este-oeste (se obtiene automáticamente)</p>
                    </TooltipContent>
                  </Tooltip>
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
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded flex items-center justify-between">
                  <div>
                    ✓ Coordenadas obtenidas de: {lastGeocodedAddress}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${currentCoordinates.lat},${currentCoordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    <MapPin className="h-3 w-3" />
                    Ver en Maps
                  </a>
                </div>
              )}

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="capitalization_rate" className="cursor-help">Tasa de Capitalización Mensual (%)</Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Porcentaje mensual usado para convertir arriendo en valor de propiedad. Refleja el rendimiento esperado del mercado inmobiliario</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="capitalization_rate"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  placeholder="Ej: 0.5"
                  value={capitalizationRate}
                  onChange={(e) => {
                    setCapitalizationRate(e.target.value)
                    setLastSavedValuation(null) // Limpiar hash cuando cambie la tasa
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tasa mensual usada para capitalizar el arriendo y estimar valor por renta (típicamente 0.5% - 1.5%)
                </p>
              </div>

              <Button 
                type="button" 
                className="w-full transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none" 
                disabled={loading}
                onClick={handleCalculateValuation}
              >
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
                {(results.average_valuation || results.capitalized_value || results.total_sell_price) && (
                  <div className="space-y-4">
                    <div className="p-6 border-2 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                      <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2 text-lg">
                        <Calculator className="h-5 w-5" />
                        Avalúo Final
                      </h3>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-900 mb-2">
                          {editableFinalPrice ? formatCurrency(parseFloat(editableFinalPrice)) : 
                           formatCurrency(results.average_valuation || results.capitalized_value || results.total_sell_price!)}
                        </div>
                        <p className="text-sm text-purple-600">
                          {results.average_valuation ? 
                            'Promedio entre valoración por venta y por renta capitalizada' : 
                            'Valoración calculada por metodología'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Campo editable para valor final */}
                    <div className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                      <Label htmlFor="editable_final_price" className="text-orange-800 font-semibold">
                        Valor Final Ajustado (Opcional)
                      </Label>
                      <Input
                        id="editable_final_price"
                        type="number"
                        min="1"
                        placeholder="Ingrese valor ajustado si es necesario"
                        value={editableFinalPrice}
                        onChange={(e) => {
                          setEditableFinalPrice(e.target.value)
                          setLastSavedValuation(null) // Limpiar hash cuando cambie el precio final
                        }}
                        className="mt-2"
                      />
                      <p className="text-xs text-orange-700 mt-2">
                        Modifique este valor si como avaluador considera que debe ajustarse el resultado final
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
                        <Badge variant="outline">{formatCurrency(results.rent_monthly_total!)}</Badge>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          type="button"
                          onClick={handleSaveValuation}
                          disabled={saving || !valuationName.trim()}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none"
                        >
                          {saving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {saving ? 'Guardando...' : 'Guardar Avalúo'}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {saving 
                          ? 'Guardando avalúo...' 
                          : !valuationName.trim() 
                            ? 'Ingrese un nombre para el avalúo antes de guardar'
                            : 'Guardar este avalúo en el historial'
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
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
      
      {/* Tabla de Historial de Avalúos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Avalúos
          </CardTitle>
          <CardDescription>
            Lista de todos los avalúos realizados ordenados del más reciente al más antiguo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Área (m²)</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Habitaciones</TableHead>
                    <TableHead>Baños</TableHead>
                    <TableHead>Estrato</TableHead>
                    <TableHead>Precio Final</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valuationsLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          Cargando avalúos...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : valuationsData?.valuations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No hay avalúos guardados aún
                      </TableCell>
                    </TableRow>
                  ) : (
                    valuationsData?.valuations.map((valuation) => (
                      <TableRow key={valuation.id}>
                        <TableCell className="font-medium">{valuation.valuation_name}</TableCell>
                        <TableCell>{valuation.area}</TableCell>
                        <TableCell>
                          {propertyTypes.find(t => t.value === valuation.property_type)?.label || 'Otro'}
                        </TableCell>
                        <TableCell>{valuation.rooms}</TableCell>
                        <TableCell>{valuation.baths}</TableCell>
                        <TableCell>Estrato {valuation.stratum}</TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatCurrency(valuation.final_price)}
                        </TableCell>
                        <TableCell>
                          {new Date(valuation.created_at).toLocaleDateString('es-CO')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditValuation(valuation)}
                              className="flex items-center gap-1 transition-all duration-200 hover:scale-105 hover:shadow-md"
                            >
                              <Edit className="h-3 w-3" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePaymentPlan(valuation)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200 hover:scale-105 hover:shadow-md"
                            >
                              <FileText className="h-3 w-3" />
                              Plan de pagos
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteValuation(valuation)}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 hover:scale-105 hover:shadow-md"
                            >
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Paginación */}
          {valuationsData?.pagination && valuationsData.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {((valuationsData.pagination.page - 1) * valuationsData.pagination.limit) + 1} a {Math.min(valuationsData.pagination.page * valuationsData.pagination.limit, valuationsData.pagination.total_count)} de {valuationsData.pagination.total_count} avalúos
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleValuationsPageChange(currentValuationsPage - 1)}
                  disabled={!valuationsData.pagination.has_prev || valuationsLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  <span className="text-sm">
                    Página {valuationsData.pagination.page} de {valuationsData.pagination.total_pages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleValuationsPageChange(currentValuationsPage + 1)}
                  disabled={!valuationsData.pagination.has_next || valuationsLoading}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Modal de Plan de Pagos */}
      <Dialog open={showPaymentPlanForm} onOpenChange={setShowPaymentPlanForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Plan de Pagos - {selectedValuation?.valuation_name}
            </DialogTitle>
            <DialogDescription>
              Complete la información requerida para generar el plan de pagos
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handlePaymentPlanSubmit} className="space-y-6">
            {/* Subtítulo: Flujo Toperty Interno */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Flujo Toperty Interno</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="area_pp" className="cursor-help">Área (m²)</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Área total de la propiedad en metros cuadrados</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="area_pp"
                  type="number"
                  value={paymentPlanData.area}
                  onChange={(e) => handlePaymentPlanChange('area', e.target.value)}
                  placeholder="Ej: 80"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="commercial_value" className="cursor-help">Valor Comercial</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Valor comercial estimado de la propiedad</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="commercial_value"
                  type="text"
                  value={paymentPlanData.commercial_value && !isNaN(parseFloat(paymentPlanData.commercial_value)) ? formatCurrency(parseFloat(paymentPlanData.commercial_value)) : paymentPlanData.commercial_value}
                  onChange={(e) => handlePaymentPlanChange('commercial_value', e.target.value)}
                  placeholder="Ej: $ 250.000.000"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="average_purchase_value" className="cursor-help">Valor de Compra Promedio</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Valor promedio de compra en la zona</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="average_purchase_value"
                  type="text"
                  value={paymentPlanData.average_purchase_value ? formatInputValue(paymentPlanData.average_purchase_value) : ''}
                  onChange={(e) => handlePaymentPlanChange('average_purchase_value', e.target.value)}
                  placeholder="Ej: 240,000,000"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="asking_price" className="cursor-help">Asking Price</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Precio solicitado por el vendedor</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="asking_price"
                  type="text"
                  value={paymentPlanData.asking_price ? formatInputValue(paymentPlanData.asking_price) : ''}
                  onChange={(e) => handlePaymentPlanChange('asking_price', e.target.value)}
                  placeholder="Ej: 260,000,000"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="user_down_payment" className="cursor-help">Cuota Inicial del Usuario</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Monto que el usuario puede pagar de cuota inicial</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="user_down_payment"
                  type="text"
                  value={paymentPlanData.user_down_payment ? formatInputValue(paymentPlanData.user_down_payment) : ''}
                  onChange={(e) => handlePaymentPlanChange('user_down_payment', e.target.value)}
                  placeholder="Ej: 50,000,000"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="program_months" className="cursor-help">Meses en el Programa</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Duración en meses del programa de financiación</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="program_months"
                  type="number"
                  value={paymentPlanData.program_months}
                  onChange={(e) => handlePaymentPlanChange('program_months', e.target.value)}
                  placeholder="Ej: 24"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="potential_down_payment" className="cursor-help">Cuota Inicial Potencial</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Cuota inicial potencial después del programa</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="potential_down_payment"
                  type="text"
                  value={paymentPlanData.potential_down_payment ? formatInputValue(paymentPlanData.potential_down_payment) : ''}
                  onChange={(e) => handlePaymentPlanChange('potential_down_payment', e.target.value)}
                  placeholder="Ej: 100,000,000"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="bank_mortgage_rate" className="cursor-help">Tasa Bancaria Hipotecaria (%)</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Tasa de interés bancaria para crédito hipotecario</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="bank_mortgage_rate"
                  type="number"
                  step="0.01"
                  value={paymentPlanData.bank_mortgage_rate}
                  onChange={(e) => handlePaymentPlanChange('bank_mortgage_rate', e.target.value)}
                  placeholder="Ej: 12.5"
                  required
                />
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="dupla_bank_rate" className="cursor-help">Tasa Bancaria Duppla (%)</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Tasa de interés para financiación duppla</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  id="dupla_bank_rate"
                  type="number"
                  step="0.01"
                  value={paymentPlanData.dupla_bank_rate}
                  onChange={(e) => handlePaymentPlanChange('dupla_bank_rate', e.target.value)}
                  placeholder="Ej: 15.0"
                  required
                />
              </div>
            </div>
            </div>
            
            {/* Subtítulo: Para Envío Usuario */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Para Envío Usuario</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="client_name" className="cursor-help">Nombre del Cliente</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Nombre completo del cliente interesado</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="client_name"
                    type="text"
                    value={paymentPlanData.client_name}
                    onChange={(e) => handlePaymentPlanChange('client_name', e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="address_pp" className="cursor-help">Dirección</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Dirección completa de la propiedad</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="address_pp"
                    type="text"
                    value={paymentPlanData.address}
                    onChange={(e) => handlePaymentPlanChange('address', e.target.value)}
                    placeholder="Ej: Calle 123 #45-67"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="city_pp" className="cursor-help">Ciudad</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Ciudad donde se ubica la propiedad</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="city_pp"
                    type="text"
                    value={paymentPlanData.city}
                    onChange={(e) => handlePaymentPlanChange('city', e.target.value)}
                    placeholder="Ej: Bogotá"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="country_pp" className="cursor-help">País</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>País donde se ubica la propiedad</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="country_pp"
                    type="text"
                    value={paymentPlanData.country}
                    onChange={(e) => handlePaymentPlanChange('country', e.target.value)}
                    placeholder="Ej: Colombia"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="construction_year" className="cursor-help">Año de Construcción</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Año en que fue construida la propiedad</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="construction_year"
                    type="number"
                    value={paymentPlanData.construction_year}
                    onChange={(e) => handlePaymentPlanChange('construction_year', e.target.value)}
                    placeholder="Ej: 2015"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="stratum_pp" className="cursor-help">Estrato</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Clasificación socioeconómica del sector (1-6)</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="stratum_pp"
                    type="number"
                    min="1"
                    max="6"
                    value={paymentPlanData.stratum}
                    onChange={(e) => handlePaymentPlanChange('stratum', e.target.value)}
                    placeholder="Ej: 3"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="apartment_type" className="cursor-help">Apartamento</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Tipo o características del apartamento</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="apartment_type"
                    type="number"
                    value={paymentPlanData.apartment_type}
                    onChange={(e) => handlePaymentPlanChange('apartment_type', e.target.value)}
                    placeholder="Ej: 1302"
                    required
                  />
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="private_parking" className="cursor-help">Parqueaderos Privados</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Número de parqueaderos privados disponibles</p>
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    id="private_parking"
                    type="number"
                    min="0"
                    value={paymentPlanData.private_parking}
                    onChange={(e) => handlePaymentPlanChange('private_parking', e.target.value)}
                    placeholder="Ej: 1"
                    required
                  />
                </div>

              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClosePaymentPlanForm}
                className="flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <FileText className="h-4 w-4" />
                Generar Plan de Pagos
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}