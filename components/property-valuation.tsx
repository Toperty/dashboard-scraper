"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import jsPDF from 'jspdf'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, DollarSign, Home, MapPin, Search, Save, ChevronLeft, ChevronRight, History, Edit, Trash2, FileText, X, Check, ExternalLink, Pin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Toast } from '@/components/ui/toast'
import { addInterFont } from '@/lib/inter-font'
import { useGeocoding } from "@/hooks/use-geocoding"
import { useConfirm } from "@/hooks/use-confirm"
import { fetchValuations, deleteValuation, toggleValuationFavorite, type Valuation, type ValuationsResponse } from "@/lib/api"
import { InvestorPresentationForm } from "@/components/investor-pdf-form"

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

// Componente optimizado para campos simples sin tooltip
const SimpleField = ({ 
  label, 
  id, 
  type = "text", 
  value, 
  onChange, 
  placeholder, 
  required = false 
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <div>
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
)

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
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showToast, setShowToast] = useState(false)
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
  
  // Estado para favoritos y filtros
  const [favoriteValuations, setFavoriteValuations] = useState<number[]>([])
  const [filters, setFilters] = useState({
    propertyType: '',
    dateFrom: '',
    dateTo: '',
    priceMin: '',
    priceMax: '',
    searchName: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showFavoriteReplace, setShowFavoriteReplace] = useState<number | null>(null)
  const [updatingFavorite, setUpdatingFavorite] = useState<number | null>(null) // ID del favorito que se está actualizando
  
  // Estados temporales para los inputs de precio (para mostrar mientras se escribe)
  const [tempPriceMin, setTempPriceMin] = useState('')
  const [tempPriceMax, setTempPriceMax] = useState('')
  
  // Funciones para formatear inputs de precio
  const formatPriceInput = (value: string): string => {
    const numbers = value.replace(/\D/g, '')
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  
  const getPriceValue = (value: string): string => {
    return value.replace(/,/g, '')
  }
  
  // Estado para el formulario de plan de pagos
  const [showPaymentPlanForm, setShowPaymentPlanForm] = useState(false)
  const [isEditingPaymentPlan, setIsEditingPaymentPlan] = useState(false)
  const [loadingPaymentPlanId, setLoadingPaymentPlanId] = useState<number | null>(null)
  const [selectedValuation, setSelectedValuation] = useState<Valuation | null>(null)
  
  // Estado para PDF de inversionistas
  const [showInvestorPresentationForm, setShowInvestorPresentationForm] = useState(false)
  const [selectedInvestorValuation, setSelectedInvestorValuation] = useState<Valuation | null>(null)
  const [paymentPlanData, setPaymentPlanData] = useState({
    // Configuración del Programa
    programa: '' as string, // ID del template de Google Sheets (obligatorio)
    valor_lanzamiento: 'descuento' as 'descuento' | 'comercial',
    tipo_programa: 'gradiente' as 'lineal' | 'gradiente',
    tipo_vivienda: 'usada' as 'nueva' | 'usada',
    alistamiento_acabados: 'no' as 'si' | 'no',
    financiacion_gastos: 'si' as 'si' | 'no',
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
    private_parking: '',
    // Co-aplicante
    client_id: '',
    co_applicant_name: '',
    co_applicant_id: ''
  })

  // Estado unificado para el modal de acciones del dashboard
  const [dashboardActionsModal, setDashboardActionsModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    dashboardUrl: string | null
    sheetUrl: string | null
    showEditButton: boolean // true para "Ver plan existente", false para después de crear/editar
    paymentPlanId?: number | null // ID del plan de pagos para carta de aprobación
  }>({
    isOpen: false,
    title: '',
    message: '',
    dashboardUrl: null,
    sheetUrl: null,
    showEditButton: false,
    paymentPlanId: null
  })

  // Estado para el modal de carta de aprobación
  const [approvalLetterModal, setApprovalLetterModal] = useState<{
    isOpen: boolean
    paymentPlanId: number | null
  }>({
    isOpen: false,
    paymentPlanId: null
  })

  // Estado para el formulario de carta de aprobación
  const [approvalLetterForm, setApprovalLetterForm] = useState({
    // Cliente principal
    fullName: '',
    idType: '',
    idNumber: '',
    maxApprovedAmount: '',
    minInitialPayment: '',
    // Cliente secundario (opcional)
    hasSecondaryClient: false,
    secondaryFullName: '',
    secondaryIdType: '',
    secondaryIdNumber: ''
  })

  const [generatingApprovalLetter, setGeneratingApprovalLetter] = useState(false)

  // Función para formatear números con separador de miles
  const formatNumberWithThousands = (value: string) => {
    // Remover todo lo que no sea dígito
    const numbers = value.replace(/\D/g, '')
    // Formatear con separador de miles
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Función para desformatear números (quitar separadores)
  const unformatNumber = (value: string) => {
    return value.replace(/\./g, '')
  }

  // Función para generar carta de aprobación
  const handleGenerateApprovalLetter = async () => {
    if (!approvalLetterForm.fullName || !approvalLetterForm.idType || !approvalLetterForm.idNumber || 
        !approvalLetterForm.maxApprovedAmount || !approvalLetterForm.minInitialPayment) {
      setSaveMessage({
        type: 'error',
        text: 'Por favor complete todos los campos requeridos'
      })
      return
    }

    // Validar cliente secundario si está marcado
    if (approvalLetterForm.hasSecondaryClient && (!approvalLetterForm.secondaryFullName || 
        !approvalLetterForm.secondaryIdType || !approvalLetterForm.secondaryIdNumber)) {
      setSaveMessage({
        type: 'error',
        text: 'Por favor complete todos los campos del cliente secundario'
      })
      return
    }

    setGeneratingApprovalLetter(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/approval-letter/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: approvalLetterForm.fullName,
            id_type: approvalLetterForm.idType,
            id_number: approvalLetterForm.idNumber,
            max_approved_amount: parseFloat(unformatNumber(approvalLetterForm.maxApprovedAmount)),
            min_initial_payment: parseFloat(unformatNumber(approvalLetterForm.minInitialPayment)),
            has_secondary_client: approvalLetterForm.hasSecondaryClient,
            secondary_full_name: approvalLetterForm.hasSecondaryClient ? approvalLetterForm.secondaryFullName : null,
            secondary_id_type: approvalLetterForm.hasSecondaryClient ? approvalLetterForm.secondaryIdType : null,
            secondary_id_number: approvalLetterForm.hasSecondaryClient ? approvalLetterForm.secondaryIdNumber : null,
            payment_plan_id: approvalLetterModal.paymentPlanId
          })
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.approval_letter_url) {
          // Abrir la carta en una nueva pestaña
          window.open(result.approval_letter_url, '_blank')
          setSaveMessage({
            type: 'success',
            text: 'Carta de aprobación generada exitosamente'
          })
          // Cerrar modal
          setApprovalLetterModal({ isOpen: false, paymentPlanId: null })
          setApprovalLetterForm({
            fullName: '',
            idType: '',
            idNumber: '',
            maxApprovedAmount: '',
            minInitialPayment: '',
            hasSecondaryClient: false,
            secondaryFullName: '',
            secondaryIdType: '',
            secondaryIdNumber: ''
          })
        } else {
          setSaveMessage({
            type: 'error',
            text: result.message || 'Error al generar la carta de aprobación'
          })
        }
      } else {
        const error = await response.text()
        setSaveMessage({
          type: 'error',
          text: `Error del servidor: ${error}`
        })
      }
    } catch (error) {
      console.error('Error generating approval letter:', error)
      setSaveMessage({
        type: 'error',
        text: 'Error al generar la carta de aprobación. Por favor, inténtelo nuevamente.'
      })
    } finally {
      setGeneratingApprovalLetter(false)
    }
  }
  const [generatingPDFInModal, setGeneratingPDFInModal] = useState(false)

  const loadValuations = useCallback(async () => {
    try {
      setValuationsLoading(true)
      console.log('Loading valuations with filters:', filters) // Debug
      const data = await fetchValuations(currentValuationsPage, 10, filters)
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
  }, [currentValuationsPage, filters])

  // Función para generar PDF completo desde el modal
  const generatePDFFromModal = async (dashboardUrl: string) => {
    try {
      setGeneratingPDF(true)
      
      // Pequeño delay para permitir que la UI se actualice antes de la generación pesada del PDF
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const token = dashboardUrl.split('/').pop()?.split('?')[0]
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/dashboard/${token}/user`)
      
      if (!response.ok) {
        throw new Error('Error al obtener datos del dashboard')
      }
      
      const data = await response.json()
      const dashboardData = data.dashboard
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const primaryTextColor = [0, 24, 69] // #001845
      const sectionTitleColor = [5, 103, 201] // #0567C9
      const bodyTextColor = [136, 136, 136] // #888888
      const separatorColor = [220, 220, 220] // Light gray for subtle separators
      
      // Helper function to draw subtle separator
      const drawSectionSeparator = (yPosition: number): number => {
        pdf.setDrawColor(...separatorColor)
        pdf.setLineWidth(0.3)
        pdf.line(margin, yPosition, pageWidth - margin, yPosition)
        return yPosition + 8
      }
      
      // Configurar fuente Inter (o Arial como fallback)
      await addInterFont(pdf)
      
      const formatCurrency = (value: any): string => {
        if (!value) return 'N/A'
        const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.,]/g, '').replace(/,/g, ''))
        if (isNaN(num)) return String(value)
        return `$${Math.round(num).toLocaleString('es-CO')}`
      }
      
      const addPageHeader = async () => {
        try {
          const headerImg = new Image()
          headerImg.crossOrigin = 'anonymous'
          const headerLoaded = await new Promise((resolve) => {
            headerImg.onload = () => resolve(true)
            headerImg.onerror = () => resolve(false)
            headerImg.src = '/header.png'
          })
          if (headerLoaded) {
            // Calcular altura proporcional manteniendo aspect ratio original (3616x589)
            const aspectRatio = 589 / 3616
            const headerHeight = pageWidth * aspectRatio
            pdf.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerHeight)
          }
        } catch (error) {
          console.warn('Header no disponible:', error)
        }
      }
      
      const addPageFooter = async () => {
        try {
          const footerImg = new Image()
          footerImg.crossOrigin = 'anonymous'
          const footerLoaded = await new Promise((resolve) => {
            footerImg.onload = () => resolve(true)
            footerImg.onerror = () => resolve(false)
            footerImg.src = '/footer.png'
          })
          if (footerLoaded) {
            pdf.addImage(footerImg, 'PNG', 0, pageHeight - 25, pageWidth, 25)
          }
        } catch (error) {
          console.warn('Footer no disponible:', error)
        }
      }
      
      // PÁGINA 1
      await addPageHeader()
      let yPos = 60
      pdf.setFontSize(17)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...primaryTextColor)
      pdf.text('Plan de pagos', margin, yPos)
      
      pdf.setLineWidth(1)
      pdf.setDrawColor(...primaryTextColor)
      yPos += 5
      pdf.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 10
      // INFORMACIÓN DEL CLIENTE
      pdf.setFontSize(14)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...sectionTitleColor)
      pdf.text('Información del cliente', margin, yPos)
      
      yPos += 12
      pdf.setFontSize(12)
      pdf.setFont('Inter', 'normal')
      pdf.setTextColor(...bodyTextColor)
      
      const clientInfo = [
        { label: 'Cliente:', value: `${dashboardData.data?.para_usuario?.client_name || 'N/A'}` },
        { label: 'C.C.:', value: '' },
        { label: 'Propiedad:', value: `${dashboardData.data?.para_usuario?.address || 'N/A'}` }
      ]
      
      if (dashboardData.data?.para_usuario?.co_applicant_name) {
        clientInfo.push({ label: 'Co-aplicante:', value: `${dashboardData.data.para_usuario.co_applicant_name}` })
        clientInfo.push({ label: 'C.C. Co-aplicante:', value: '_______________' })
      }
      
      clientInfo.push(
        { label: 'Fecha de emisión:', value: `${new Date().toLocaleDateString('es-CO')}` },
        { label: 'Validez del plan:', value: `${dashboardData.days_remaining} días` }
      )
      
      clientInfo.forEach(info => {
        pdf.setFont('Inter', 'bold')
        const labelWidth = pdf.getTextWidth(info.label)
        pdf.text(info.label, margin, yPos)
        pdf.setFont('Inter', 'normal')
        pdf.text(` ${info.value}`, margin + labelWidth, yPos)
        yPos += 8
      })

      yPos = drawSectionSeparator(yPos)
      
      // INFORMACIÓN DEL PROGRAMA
      pdf.setFontSize(14)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...sectionTitleColor)
      pdf.text('Información del programa', margin, yPos)
      
      yPos += 12
      pdf.setFontSize(12)
      pdf.setFont('Inter', 'normal')
      pdf.setTextColor(...bodyTextColor)
      
      const programInfo1 = [
        { label: 'Tipo de vivienda:', value: `${dashboardData.data?.flujo_interno?.tipo_vivienda || 'N/A'}` },
        { label: 'Área:', value: `${dashboardData.data?.para_usuario?.area || 'N/A'} m²` },
        { label: 'Valor comercial:', value: `${formatCurrency(dashboardData.data?.para_usuario?.commercial_value)}` },
        { label: 'Valor de lanzamiento:', value: `${formatCurrency(dashboardData.data?.para_usuario?.valor_lanzamiento)}` },
        { label: 'Cuota inicial:', value: `${formatCurrency(dashboardData.data?.flujo_interno?.user_down_payment)}` }
      ]
      
      const programInfo2 = [
        { label: 'Valor a financiar:', value: `${formatCurrency(dashboardData.data?.flujo_interno?.valor_a_financiar)}` },
        { label: 'Duración:', value: `${dashboardData.data?.flujo_interno?.program_months || 'N/A'} meses` },
        { label: 'Ciudad:', value: `${dashboardData.data?.para_usuario?.city || 'N/A'}` },
        { label: 'Estrato:', value: `${dashboardData.data?.para_usuario?.stratum || 'N/A'}` },
        { label: 'Año construcción:', value: `${dashboardData.data?.para_usuario?.construction_year || 'N/A'}` }
      ]
      
      const startYPos = yPos
      programInfo1.forEach(info => {
        pdf.setFont('Inter', 'bold')
        const labelWidth = pdf.getTextWidth(info.label)
        pdf.text(info.label, margin, yPos)
        pdf.setFont('Inter', 'normal')
        pdf.text(` ${info.value}`, margin + labelWidth, yPos)
        yPos += 8
      })
      
      yPos = startYPos
      programInfo2.forEach(info => {
        pdf.setFont('Inter', 'bold')
        const labelWidth = pdf.getTextWidth(info.label)
        pdf.text(info.label, margin + 95, yPos)
        pdf.setFont('Inter', 'normal')
        pdf.text(` ${info.value}`, margin + 95 + labelWidth, yPos)
        yPos += 8
      })

      // LÓGICA BASADA EN LA EXISTENCIA DE DATOS:
      // Caso 1: No existen datos de acabados (programas 1 y 7) - No mostrar nada
      // Caso 2: Existen datos pero con_alistamiento es 'No' - Solo mostrar ingresos a certificar
      // Caso 3: Existen datos y con_alistamiento es 'Si' - Mostrar todo

      const acabadosExisten = dashboardData.data?.acabados?.ingresos_certificar_pesos !== undefined &&
                             dashboardData.data?.acabados?.ingresos_certificar_pesos !== null &&
                             dashboardData.data?.acabados?.ingresos_certificar_pesos !== ''

      // INGRESOS A CERTIFICAR - Si existen los datos de acabados (no es programa 1 o 7)
      const showIngresos = acabadosExisten

      // PAQUETE ACABADOS - Solo si existen los datos Y con_alistamiento es 'Si'
      const showPaqueteAcabados = acabadosExisten &&
                                  (dashboardData.data?.flujo_interno?.con_alistamiento === 'si' || 
                                   dashboardData.data?.flujo_interno?.con_alistamiento === 'Si')

      if (showIngresos || showPaqueteAcabados) {
        yPos = drawSectionSeparator(yPos)
        
        pdf.setFontSize(14)
        pdf.setFont('Inter', 'bold')
        pdf.setTextColor(...sectionTitleColor)
        
        if (showIngresos && showPaqueteAcabados) {
          pdf.text('Información de acabados', margin, yPos)
        } else if (showIngresos) {
          pdf.text('Ingresos a certificar', margin, yPos)
        } else {
          pdf.text('Paquete de acabados', margin, yPos)
        }
        
        yPos += 12
        pdf.setFontSize(12)
        pdf.setFont('Inter', 'normal')
        pdf.setTextColor(...bodyTextColor)
        
        const startYPosAcabados = yPos
        let leftColumnUsed = false

        // Ingresos a certificar (si aplica)
        if (showIngresos) {
          pdf.setFont('Inter', 'bold')
          
          pdf.setFont('Inter', 'normal')
          const ingresosInfo = [
            { label: 'En pesos:', value: formatCurrency(dashboardData.data.acabados.ingresos_certificar_pesos) },
            { label: 'En SMMLV:', value: `${parseFloat(dashboardData.data.acabados.ingresos_certificar_smmlv || '0').toFixed(2)}` }
          ]
          
          ingresosInfo.forEach(info => {
            pdf.setFont('Inter', 'bold')
            const labelWidth = pdf.getTextWidth(info.label)
            pdf.text(info.label, margin, yPos)
            pdf.setFont('Inter', 'normal')
            pdf.text(` ${info.value}`, margin + labelWidth, yPos)
            yPos += 8
          })
          leftColumnUsed = true
        }
        
        // Paquete de acabados (si aplica)
        if (showPaqueteAcabados) {
          if (leftColumnUsed) {
            // Si ya usamos la columna izquierda, usamos la derecha
            yPos = startYPosAcabados
          }
          
          const xPos = leftColumnUsed ? margin + 95 : margin
          
          pdf.setFont('Inter', 'bold')
          pdf.text(`${dashboardData.data.acabados.paquete_nombre || 'Paquete Contratista Bolívar'}`, xPos, yPos)
          yPos += 8
          
          pdf.setFont('Inter', 'normal')
          const acabadosInfo = [
            { label: 'Valor paquete:', value: formatCurrency(dashboardData.data.acabados.valor_paquete) },
            { label: 'Valor por m²:', value: formatCurrency(dashboardData.data.acabados.valor_paquete_m2) }
          ]
          
          acabadosInfo.forEach(info => {
            pdf.setFont('Inter', 'bold')
            const labelWidth = pdf.getTextWidth(info.label)
            pdf.text(info.label, xPos, yPos)
            pdf.setFont('Inter', 'normal')
            pdf.text(` ${info.value}`, xPos + labelWidth, yPos)
            yPos += 8
          })
        }
      }

      // Verificar si necesitamos nueva página para el análisis comparativo
      if (yPos > pageHeight - 80) { // Mantener margen para evitar sobrelapamiento con footer
        pdf.addPage()
        yPos = margin + 10
      } else {
        yPos = drawSectionSeparator(yPos)
      }
      
      // ANÁLISIS COMPARATIVO
      pdf.setFontSize(16)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...primaryTextColor)
      pdf.text('Análisis comparativo', margin, yPos)
      
      yPos += 12
      pdf.setFontSize(10)
      
      if (dashboardData.data?.graficas?.tabla_comparativa) {
        const tabla = dashboardData.data.graficas.tabla_comparativa
        
        pdf.setFont('Inter', 'bold')
        pdf.setTextColor(...sectionTitleColor)
        pdf.text('Concepto', margin, yPos)
        pdf.text('Toperty', margin + 70, yPos)
        pdf.text('Bancos Trad.', margin + 120, yPos)
        pdf.text('Otros R2O', margin + 150, yPos)
        yPos += 4
        
        pdf.setLineWidth(0.5)
        pdf.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 5
        
        pdf.setFont('Inter', 'normal')
        pdf.setTextColor(...bodyTextColor)
        
        // Mostrar todas las filas disponibles, con formato especial para porcentajes
        if (tabla.data && tabla.data.length > 0) {
          tabla.data.forEach((row: any[]) => {
            if (row.length >= 7) {
              const concepto = row[0] || ''
              let valor1 = row[2]
              let valor2 = row[4] 
              let valor3 = row[6]
              
              // Formatear según el tipo de dato
              if (concepto.toLowerCase().includes('cuota mensual / vc') || concepto.toLowerCase().includes('tasa de interés')) {
                // Es un porcentaje
                valor1 = valor1 ? `${(valor1 * 100).toFixed(2)}%` : '0.00%'
                valor2 = valor2 ? `${(valor2 * 100).toFixed(2)}%` : '0.00%'
                valor3 = valor3 ? `${(valor3 * 100).toFixed(2)}%` : '0.00%'
              } else if (concepto.toLowerCase().includes('pesos / millón')) {
                // Es un ratio
                valor1 = valor1 ? `$${Math.round(valor1).toLocaleString()}` : 'N/A'
                valor2 = valor2 ? `$${Math.round(valor2).toLocaleString()}` : 'N/A'
                valor3 = valor3 ? `$${Math.round(valor3).toLocaleString()}` : 'N/A'
              } else {
                // Es moneda
                valor1 = formatCurrency(valor1)
                valor2 = formatCurrency(valor2)
                valor3 = formatCurrency(valor3)
              }
              
              pdf.text(concepto, margin, yPos)
              pdf.text(valor1, margin + 70, yPos)
              pdf.text(valor2, margin + 120, yPos)
              pdf.text(valor3, margin + 150, yPos)
              yPos += 6
            }
          })
        } else {
          // Si no hay datos, mostrar estructura básica con los elementos mencionados
          const datosComparativos = [
            ['Valor Comercial', '$469.745.502', '$469.745.502', '$469.745.502'],
            ['Valor de Compra', '$400.000.000', '$400.000.000', '$400.000.000'],
            ['Cuota Inicial', '$50.000.000', '$80.000.000', '$60.000.000'],
            ['Valor Financiado', '$362.844.800', '$320.000.000', '$340.000.000'],
            ['Cuota Mensual Completa', '$4.372.954', '$3.635.650', '$3.683.333'],
            ['Cuota Mensual / VC', '0.93%', '0.77%', '0.78%'],
            ['Interés', 'N/A', 'N/A', 'N/A'],
            ['Tasa de Interés', 'N/A', '12.5%', '11.8%'],
            ['Pesos / Millón', 'N/A', 'N/A', 'N/A']
          ]
          
          datosComparativos.forEach(row => {
            pdf.text(row[0], margin, yPos)
            pdf.text(row[1], margin + 70, yPos)
            pdf.text(row[2], margin + 120, yPos)
            pdf.text(row[3], margin + 150, yPos)
            yPos += 6
          })
        }
      }
      
      // PROYECCIÓN DE PAGOS - Solo nueva página si es necesario
      if (yPos > pageHeight - 30) { // Si no hay suficiente espacio para empezar la tabla
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      } else {
        yPos = drawSectionSeparator(yPos)
      }
      
      pdf.setFontSize(16)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...primaryTextColor)
      pdf.text('Proyección Completa De Pagos', margin, yPos)
      
      yPos += 15
      pdf.setFontSize(15)
      pdf.setFont('Inter', 'normal')
      pdf.setTextColor(...bodyTextColor)
      
      if (dashboardData.data?.user_cash_flow) {
        const cashFlow = dashboardData.data.user_cash_flow
        const mesNumero = cashFlow.mes_numero || []
        const arriendo = cashFlow.renta || []
        const abono = cashFlow.compra_parcial || []
        const cuotaTotal = cashFlow.total_pagos_rent_to_own || []
        const participacion = cashFlow.participacion_adquirida || []
        
        // Usar la longitud real de los datos, asegurándonos de mostrar TODO
        const totalDataLength = Math.max(mesNumero.length, arriendo.length, abono.length, cuotaTotal.length, participacion.length)
        const programMonths = Math.min(60, totalDataLength - 1) // Excluir mes 0 si existe
        
        if (programMonths > 0) {
          // Headers con formato consistente
          pdf.setFont('Inter', 'bold')
          pdf.setTextColor(...sectionTitleColor)
          pdf.setFontSize(10)
          pdf.text('Mes', margin, yPos)
          pdf.text('Arriendo', margin + 25, yPos)
          pdf.text('Abono', margin + 65, yPos)
          pdf.text('Cuota Total', margin + 105, yPos)
          pdf.text('Participación', margin + 145, yPos)
          yPos += 4
          
          pdf.setLineWidth(0.5)
          pdf.line(margin, yPos, pageWidth - margin, yPos)
          yPos += 5
          
          pdf.setFont('Inter', 'normal')
          pdf.setTextColor(...bodyTextColor)
          pdf.setFontSize(10)
          
          // Mostrar TODOS los meses disponibles en una sola columna, empezando desde mes 0
          for (let i = 0; i <= programMonths; i++) {
            // Verificar si necesitamos una nueva página
            if (yPos > pageHeight - 60) {
              pdf.addPage()
              await addPageHeader()
              yPos = 60
              
              // Repetir título y headers
              pdf.setFontSize(15)
              pdf.setFont('Inter', 'bold')
              pdf.setTextColor(...primaryTextColor)
              pdf.text('Proyección Completa De Pagos', margin, yPos)
              yPos += 15
              
              pdf.setFontSize(10)
              pdf.setFont('Inter', 'bold')
              pdf.setTextColor(...sectionTitleColor)
              pdf.text('Mes', margin, yPos)
              pdf.text('Arriendo', margin + 25, yPos)
              pdf.text('Abono', margin + 65, yPos)
              pdf.text('Cuota Total', margin + 105, yPos)
              pdf.text('Participación', margin + 145, yPos)
              yPos += 4
              
              pdf.setLineWidth(0.5)
              pdf.line(margin, yPos, pageWidth - margin, yPos)
              yPos += 5
              
              pdf.setFont('Inter', 'normal')
              pdf.setTextColor(...bodyTextColor)
              pdf.setFontSize(10)
            }
            
            // Mostrar datos del mes actual
            const mesTexto = mesNumero[i] !== undefined ? `${mesNumero[i]}` : `${i}`
            const arriendoTexto = formatCurrency(arriendo[i] || 0)
            const abonoTexto = formatCurrency(abono[i] || 0)
            const cuotaTotalTexto = formatCurrency(cuotaTotal[i] || 0)
            const participacionTexto = participacion[i] !== undefined ? `${(participacion[i] * 100).toFixed(1)}%` : '0.0%'
            
            // Usar texto más corto para que quepa mejor
            const arriendoCorto = arriendoTexto.length > 12 ? arriendoTexto.substring(0, 10) + '...' : arriendoTexto
            const abonoCorto = abonoTexto.length > 12 ? abonoTexto.substring(0, 10) + '...' : abonoTexto
            const cuotaCorto = cuotaTotalTexto.length > 12 ? cuotaTotalTexto.substring(0, 10) + '...' : cuotaTotalTexto
            
            pdf.text(mesTexto, margin, yPos)
            pdf.text(arriendoCorto, margin + 25, yPos)
            pdf.text(abonoCorto, margin + 65, yPos)
            pdf.text(cuotaCorto, margin + 105, yPos)
            pdf.text(participacionTexto, margin + 145, yPos)
            
            yPos += 5
          }
          
          // Agregar un resumen al final si tenemos datos
          if (programMonths >= 12) {
            yPos += 10
            pdf.setFont('Inter', 'bold')
            pdf.setFontSize(12)
            pdf.setTextColor(...primaryTextColor)
            pdf.text(`RESUMEN: ${programMonths} meses de proyección mostrados`, margin, yPos)
            yPos += 6
            
            // Mostrar totales si es posible
            const totalCuotas = cuotaTotal.slice(1, programMonths + 1).reduce((sum: number, val: number) => sum + (val || 0), 0)
            const participacionFinal = participacion[programMonths] ? `${(participacion[programMonths] * 100).toFixed(1)}%` : '0.0%'
            
            pdf.setFont('Inter', 'normal')
            pdf.setTextColor(...sectionTitleColor)
            pdf.text(`Total pagado: ${formatCurrency(totalCuotas)}`, margin, yPos)
            yPos += 6
            pdf.setTextColor(...bodyTextColor)
            pdf.text(`Participación final: ${participacionFinal}`, margin, yPos)
          }
        }
      }
      
      // GRÁFICAS Y ANÁLISIS - Solo nueva página si es necesario
      if (yPos > pageHeight - 60) {
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      } else {
        yPos += 6
        yPos = drawSectionSeparator(yPos)
      }
      
      pdf.setFontSize(14)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...sectionTitleColor)
      pdf.text('Gráficas y análisis', margin, yPos)
      
      yPos += 15
      pdf.setFontSize(14)
      pdf.setFont('Inter', 'normal')
      pdf.setTextColor(...bodyTextColor)
      pdf.setTextColor(...primaryTextColor)
      
      // Agregar información sobre las gráficas
      console.log('Datos de gráficas:', dashboardData.data?.graficas)
      if (dashboardData.data?.graficas?.grafica1) {
        const grafica1 = dashboardData.data.graficas.grafica1
        console.log('Grafica1 data:', grafica1)
        
        pdf.setFontSize(14)
        pdf.setFont('Inter', 'bold')
        pdf.text('Evolución De Inversión', margin, yPos)
        yPos += 2
        
        pdf.setFontSize(10)
        pdf.setFont('Inter', 'normal')
        
        // Adaptar la estructura de datos para el formato que viene del backend
        const chartData = []
        if (grafica1.headers && grafica1.serie1) {
          // Construir el array de datos desde headers y series
          for (let i = 0; i < Math.min(grafica1.headers.length, 12); i++) {
            const dataPoint: any = {
              name: `Mes ${grafica1.headers[i]}`
            }
            if (grafica1.label1 && grafica1.serie1[i]) dataPoint[grafica1.label1] = grafica1.serie1[i]
            if (grafica1.label2 && grafica1.serie2[i]) dataPoint[grafica1.label2] = grafica1.serie2[i]
            if (grafica1.label3 && grafica1.serie3[i]) dataPoint[grafica1.label3] = grafica1.serie3[i]
            chartData.push(dataPoint)
          }
        }
        
        if (chartData.length > 0) {
          // Renderizar gráfica como chart con barras y línea
          const chartWidth = 150
          const chartHeight = 60
          const chartX = (pageWidth - chartWidth) / 2 // Centrar horizontalmente
          const chartY = yPos + 10 // Reducir espacio para etiquetas del eje Y
          
          // Calcular valores máximos para escala
          let maxVal1 = 0, maxVal2 = 0, maxVal3 = 0
          chartData.forEach((item: any) => {
            if (item[grafica1.label1]) maxVal1 = Math.max(maxVal1, item[grafica1.label1])
            if (item[grafica1.label2]) maxVal2 = Math.max(maxVal2, item[grafica1.label2])
            if (item[grafica1.label3]) maxVal3 = Math.max(maxVal3, item[grafica1.label3])
          })
          const maxValue = Math.max(maxVal1, maxVal2, maxVal3)
          
          if (maxValue > 0) {
            // Dibujar ejes
            pdf.setDrawColor(0, 0, 0)
            pdf.setLineWidth(0.8)
            // Eje Y
            pdf.line(chartX, chartY, chartX, chartY + chartHeight)
            // Eje X
            pdf.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight)
            
            // Etiquetas del eje Y
            pdf.setFontSize(7)
            pdf.setTextColor(...primaryTextColor)
            for (let i = 0; i <= 4; i++) {
              const value = (maxValue / 4) * i
              const yPos = chartY + chartHeight - (chartHeight / 4) * i
              const formattedValue = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}K`
              pdf.text(formattedValue, chartX - 15, yPos + 1)
              // Líneas de rejilla horizontales
              pdf.setDrawColor(230, 230, 230)
              pdf.setLineWidth(0.3)
              if (i > 0) pdf.line(chartX, yPos, chartX + chartWidth, yPos)
            }
            
            const barWidth = chartWidth / chartData.length * 0.6
            const barSpacing = chartWidth / chartData.length
            
            // Dibujar barras y puntos de línea
            const linePoints: Array<{x: number, y: number}> = []
            
            chartData.forEach((item: any, index: number) => {
              const barX = chartX + index * barSpacing + (barSpacing - barWidth) / 2
              
              // Calcular alturas para barras apiladas
              const value1 = item[grafica1.label1] || 0
              const value2 = item[grafica1.label2] || 0
              const totalValue = value1 + value2
              
              // Barra 1 (base) - Color azul muy oscuro
              if (value1 > 0) {
                const barHeight1 = (value1 / maxValue) * chartHeight
                pdf.setFillColor(2, 25, 69) // #021945
                pdf.rect(barX, chartY + chartHeight - barHeight1, barWidth, barHeight1, 'F')
                
                // Valor sobre la barra 1
                const formattedValue1 = value1 >= 1000000 ? `${(value1 / 1000000).toFixed(1)}M` : `${(value1 / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(255, 255, 255) // Texto blanco
                pdf.text(formattedValue1, barX + barWidth/2 - 3, chartY + chartHeight - barHeight1/2 + 1)
              }
              
              // Barra 2 (apilada encima) - Color celeste
              if (value2 > 0 && value1 > 0) {
                const barHeight1 = (value1 / maxValue) * chartHeight
                const barHeight2 = (value2 / maxValue) * chartHeight
                pdf.setFillColor(110, 250, 251) // #6efafb
                pdf.rect(barX, chartY + chartHeight - barHeight1 - barHeight2, barWidth, barHeight2, 'F')
                
                // Valor sobre la barra 2
                const formattedValue2 = value2 >= 1000000 ? `${(value2 / 1000000).toFixed(1)}M` : `${(value2 / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(0, 0, 0) // Texto negro para contraste
                pdf.text(formattedValue2, barX + barWidth/2 - 3, chartY + chartHeight - barHeight1 - barHeight2/2 + 1)
              } else if (value2 > 0 && value1 === 0) {
                // Si no hay valor1, dibujar valor2 desde la base
                const barHeight2 = (value2 / maxValue) * chartHeight
                pdf.setFillColor(110, 250, 251) // #6efafb
                pdf.rect(barX, chartY + chartHeight - barHeight2, barWidth, barHeight2, 'F')
                
                // Valor sobre la barra 2 (desde la base)
                const formattedValue2 = value2 >= 1000000 ? `${(value2 / 1000000).toFixed(1)}M` : `${(value2 / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(0, 0, 0)
                pdf.text(formattedValue2, barX + barWidth/2 - 3, chartY + chartHeight - barHeight2/2 + 1)
              }
              
              // Puntos de línea (label3) - Centrado en la barra
              if (item[grafica1.label3]) {
                const pointHeight = (item[grafica1.label3] / maxValue) * chartHeight
                const pointY = chartY + chartHeight - pointHeight
                const pointX = barX + barWidth / 2
                linePoints.push({x: pointX, y: pointY})
                
                // Valor sobre el punto de la línea
                const formattedValue3 = item[grafica1.label3] >= 1000000 ? 
                  `${(item[grafica1.label3] / 1000000).toFixed(1)}M` : 
                  `${(item[grafica1.label3] / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(4, 102, 201) // Azul de la línea
                pdf.text(formattedValue3, pointX - 4, pointY - 2)
              }
              
              // Etiquetas del eje X (mes)
              pdf.setFontSize(6)
              pdf.setTextColor(...primaryTextColor)
              const labelText = `M${grafica1.headers[index]}`
              pdf.text(labelText, barX + barWidth/2 - 3, chartY + chartHeight + 8)
            })
            
            // Dibujar línea conectando los puntos
            if (linePoints.length > 1) {
              pdf.setDrawColor(4, 102, 201) // #0466c9
              pdf.setLineWidth(0.5)
              for (let i = 0; i < linePoints.length - 1; i++) {
                pdf.line(linePoints[i].x, linePoints[i].y, linePoints[i + 1].x, linePoints[i + 1].y)
              }
              // Dibujar puntos como pequeños cuadrados
              linePoints.forEach(point => {
                pdf.setFillColor(4, 102, 201) // #0466c9
                pdf.rect(point.x - 0.8, point.y - 0.8, 1.6, 1.6, 'F')
              })
            }
            
            // Leyenda
            yPos += chartHeight + 20 // Más espacio para la leyenda
            pdf.setFontSize(8)
            pdf.setFont('Inter', 'normal')
            pdf.setTextColor(...primaryTextColor)
            
            // Leyenda con colores y valores (centrada)
            const legendStartX = margin
            
            // Serie 1
            pdf.setFillColor(2, 25, 69) // #021945
            pdf.rect(legendStartX, yPos, 3, 3, 'F')
            pdf.text(`${grafica1.label1 || 'Serie 1'}`, legendStartX + 5, yPos + 2)
            
            // Serie 2
            pdf.setFillColor(110, 250, 251) // #6efafb
            pdf.rect(legendStartX + 60, yPos, 3, 3, 'F')
            pdf.text(`${grafica1.label2 || 'Serie 2'}`, legendStartX + 65, yPos + 2)
            
            // Serie 3 (línea)
            pdf.setDrawColor(4, 102, 201) // #0466c9
            pdf.setLineWidth(1)
            pdf.line(legendStartX + 120, yPos + 1.5, legendStartX + 126, yPos + 1.5)
            pdf.text(`${grafica1.label3 || 'Serie 3'}`, legendStartX + 130, yPos + 2)
            
            yPos += 8
          }
        }
        yPos += 10
      } else {
        // Si no hay datos de gráfica 1, mostrar mensaje
        pdf.setFontSize(10)
        pdf.text('No se encontraron datos para la primera gráfica', margin, yPos)
        yPos += 15
      }
      
      // Segunda gráfica
      if (dashboardData.data?.graficas?.grafica2) {
        // Verificar si hay espacio suficiente para la segunda gráfica completa (título + gráfico + leyenda + footer)
        const requiredSpace = 100 // título(5) + espacio(10) + gráfico(60) + leyenda(15) + margen footer(25) = 115, pero reducimos más
        if (yPos > pageHeight - requiredSpace) {
          pdf.addPage()
          await addPageHeader()
          yPos = 60
        }
        
        const grafica2 = dashboardData.data.graficas.grafica2
        
        pdf.setFontSize(14)
        pdf.setFont('Inter', 'bold')
        pdf.text('Comparación De Flujos', margin, yPos)
        yPos += 2
        
        pdf.setFontSize(10)
        pdf.setFont('Inter', 'normal')
        
        // Adaptar la estructura de datos para el formato que viene del backend
        const chartData2 = []
        if (grafica2.headers && grafica2.serie1) {
          // Construir el array de datos desde headers y series
          for (let i = 0; i < Math.min(grafica2.headers.length, 12); i++) {
            const dataPoint: any = {
              name: `Mes ${grafica2.headers[i]}`
            }
            if (grafica2.label1 && grafica2.serie1[i]) dataPoint[grafica2.label1] = grafica2.serie1[i]
            if (grafica2.label2 && grafica2.serie2[i]) dataPoint[grafica2.label2] = grafica2.serie2[i]
            if (grafica2.label3 && grafica2.serie3[i]) dataPoint[grafica2.label3] = grafica2.serie3[i]
            chartData2.push(dataPoint)
          }
        }
        
        if (chartData2.length > 0) {
          // Renderizar segunda gráfica como chart con barras y línea
          const chartWidth = 150
          const chartHeight = 60
          const chartX = (pageWidth - chartWidth) / 2 // Centrar horizontalmente
          const chartY = yPos + 10 // Reducir espacio para etiquetas del eje Y
          
          // Calcular valores máximos para escala
          let maxVal1 = 0, maxVal2 = 0, maxVal3 = 0
          chartData2.forEach((item: any) => {
            if (item[grafica2.label1]) maxVal1 = Math.max(maxVal1, item[grafica2.label1])
            if (item[grafica2.label2]) maxVal2 = Math.max(maxVal2, item[grafica2.label2])
            if (item[grafica2.label3]) maxVal3 = Math.max(maxVal3, item[grafica2.label3])
          })
          const maxValue2 = Math.max(maxVal1, maxVal2, maxVal3)
          
          if (maxValue2 > 0) {
            // Dibujar ejes
            pdf.setDrawColor(0, 0, 0)
            pdf.setLineWidth(0.8)
            // Eje Y
            pdf.line(chartX, chartY, chartX, chartY + chartHeight)
            // Eje X
            pdf.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight)
            
            // Etiquetas del eje Y
            pdf.setFontSize(7)
            pdf.setTextColor(...primaryTextColor)
            for (let i = 0; i <= 4; i++) {
              const value = (maxValue2 / 4) * i
              const yPos = chartY + chartHeight - (chartHeight / 4) * i
              const formattedValue = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}K`
              pdf.text(formattedValue, chartX - 15, yPos + 1)
              // Líneas de rejilla horizontales
              pdf.setDrawColor(230, 230, 230)
              pdf.setLineWidth(0.3)
              if (i > 0) pdf.line(chartX, yPos, chartX + chartWidth, yPos)
            }
            
            const barGroupWidth = chartWidth / chartData2.length * 0.8
            const barIndividualWidth = barGroupWidth / 3 // 3 barras por grupo
            const barSpacing = chartWidth / chartData2.length
            
            // Dibujar barras y puntos de línea
            const linePoints2: Array<{x: number, y: number}> = []
            
            chartData2.forEach((item: any, index: number) => {
              const groupStartX = chartX + index * barSpacing + (barSpacing - barGroupWidth) / 2
              
              // Barra 1 (label1) - Color azul muy oscuro
              if (item[grafica2.label1]) {
                const barHeight1 = (item[grafica2.label1] / maxValue2) * chartHeight
                pdf.setFillColor(2, 25, 69) // #021945
                pdf.rect(groupStartX, chartY + chartHeight - barHeight1, barIndividualWidth, barHeight1, 'F')
                
                // Valor sobre la barra 1
                const formattedValue1 = item[grafica2.label1] >= 1000000 ? 
                  `${(item[grafica2.label1] / 1000000).toFixed(1)}M` : 
                  `${(item[grafica2.label1] / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(255, 255, 255) // Texto blanco
                pdf.text(formattedValue1, groupStartX + barIndividualWidth/2 - 3, chartY + chartHeight - barHeight1/2 + 1)
              }
              
              // Barra 2 (label2) - Color celeste
              if (item[grafica2.label2]) {
                const barHeight2 = (item[grafica2.label2] / maxValue2) * chartHeight
                pdf.setFillColor(110, 250, 251) // #6efafb
                pdf.rect(groupStartX + barIndividualWidth, chartY + chartHeight - barHeight2, barIndividualWidth, barHeight2, 'F')
                
                // Valor sobre la barra 2
                const formattedValue2 = item[grafica2.label2] >= 1000000 ? 
                  `${(item[grafica2.label2] / 1000000).toFixed(1)}M` : 
                  `${(item[grafica2.label2] / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(0, 0, 0) // Texto negro
                pdf.text(formattedValue2, groupStartX + barIndividualWidth + barIndividualWidth/2 - 3, chartY + chartHeight - barHeight2/2 + 1)
              }
              
              // Puntos de línea (label3) - Centrado en el grupo de barras
              if (item[grafica2.label3]) {
                const pointHeight = (item[grafica2.label3] / maxValue2) * chartHeight
                const pointY = chartY + chartHeight - pointHeight
                const pointX = groupStartX + (barGroupWidth / 2)
                linePoints2.push({x: pointX, y: pointY})
                
                // Valor sobre el punto de la línea
                const formattedValue3 = item[grafica2.label3] >= 1000000 ? 
                  `${(item[grafica2.label3] / 1000000).toFixed(1)}M` : 
                  `${(item[grafica2.label3] / 1000).toFixed(0)}K`
                pdf.setFontSize(6)
                pdf.setTextColor(4, 102, 201) // Azul de la línea
                pdf.text(formattedValue3, pointX - 4, pointY - 2)
              }
              
              // Etiquetas del eje X (mes)
              pdf.setFontSize(6)
              pdf.setTextColor(...primaryTextColor)
              const labelText = `M${grafica2.headers[index]}`
              pdf.text(labelText, groupStartX + barGroupWidth/2 - 3, chartY + chartHeight + 8)
            })
            
            // Dibujar línea conectando los puntos
            if (linePoints2.length > 1) {
              pdf.setDrawColor(4, 102, 201) // #0466c9
              pdf.setLineWidth(0.5)
              for (let i = 0; i < linePoints2.length - 1; i++) {
                pdf.line(linePoints2[i].x, linePoints2[i].y, linePoints2[i + 1].x, linePoints2[i + 1].y)
              }
              // Dibujar puntos como pequeños cuadrados
              linePoints2.forEach(point => {
                pdf.setFillColor(4, 102, 201) // #0466c9
                pdf.rect(point.x - 0.8, point.y - 0.8, 1.6, 1.6, 'F')
              })
            }
            
            // Leyenda
            yPos += chartHeight + 20 // Más espacio para la leyenda
            pdf.setFontSize(8)
            pdf.setFont('Inter', 'normal')
            pdf.setTextColor(...primaryTextColor)
            
            // Leyenda con colores y valores
            const legendStartX2 = margin
            
            // Serie 1
            pdf.setFillColor(2, 25, 69) // #021945
            pdf.rect(legendStartX2, yPos, 3, 3, 'F')
            pdf.text(`${grafica2.label1 || 'Serie 1'}`, legendStartX2 + 5, yPos + 2)
            
            // Serie 2
            pdf.setFillColor(110, 250, 251) // #6efafb
            pdf.rect(legendStartX2 + 60, yPos, 3, 3, 'F')
            pdf.text(`${grafica2.label2 || 'Serie 2'}`, legendStartX2 + 65, yPos + 2)
            
            // Serie 3 (línea)
            pdf.setDrawColor(4, 102, 201) // #0466c9
            pdf.setLineWidth(1)
            pdf.line(legendStartX2 + 120, yPos + 1.5, legendStartX2 + 126, yPos + 1.5)
            pdf.text(`${grafica2.label3 || 'Serie 3'}`, legendStartX2 + 130, yPos + 2)
            
            yPos += 8
          }
        } else {
          // Si no hay datos de gráfica 2, mostrar mensaje
          pdf.setFontSize(10)
          pdf.text('No se encontraron datos para la segunda gráfica', margin, yPos)
          yPos += 15
        }
      }
      
      // DESCARGO DE RESPONSABILIDAD - Solo nueva página si es necesario
      if (yPos > pageHeight - 60) {
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      } else {
        yPos = drawSectionSeparator(yPos)
      }
      
      pdf.setFontSize(14)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...sectionTitleColor)
      pdf.text('Descargo de responsabilidad', margin, yPos)
      
      yPos += 12
      pdf.setFontSize(12)
      pdf.setFont('Inter', 'normal')
      pdf.setTextColor(...bodyTextColor)
      
      // Texto introductorio
      const introText = `Toperty S.A.S. (en adelante "Toperty") pone a disposición el presente plan de pagos, el cual está sujeto a la negociación de Toperty con el actual propietario del inmueble. La obligación de Toperty con respecto a la adquisición del inmueble es de medio y no de resultado.`
      
      // Combinar texto intro con primera sección para calcular espacio conjunto
      const firstSection = {
        titulo: 'Naturaleza proyectiva del plan:',
        texto: 'El presente plan de pagos es una proyección elaborada con supuestos macroeconómicos para propósitos ilustrativos únicamente, y no constituye el plan de pagos final. Las cuotas mensuales están sujetas a incrementos anuales de acuerdo al Índice de Precios al Consumidor (IPC) certificado por el DANE, y el valor comercial del inmueble se actualizará en función de (i) la inflación certificada por el DANE o la tasa de incremento fija anual del 5,5% (la que sea mayor); y (ii) el tiempo que el usuario tarde en adquirir el porcentaje objetivo de participación. Por lo tanto, las cifras aquí presentadas podrán variar por factores externos que Toperty no controla, incluyendo la evolución de la inflación en Colombia y los aportes extraordinarios del usuario a modo de prepago, entre otros.'
      }
      
      // Calcular altura necesaria para intro + primera sección
      const lineasIntroPreview = pdf.splitTextToSize(introText, pageWidth - 2 * margin)
      const lineasTituloPreview = pdf.splitTextToSize(firstSection.titulo, pageWidth - 2 * margin)
      const lineasTextoPreview = pdf.splitTextToSize(firstSection.texto, pageWidth - 2 * margin)
      const totalHeight = (lineasIntroPreview.length * 5 + 10) + (lineasTituloPreview.length * 5 + 2) + (lineasTextoPreview.length * 5 + 10)
      
      // Verificar si caben intro + primera sección juntas
      if (yPos + totalHeight > pageHeight - 25) {
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      }
      
      // Renderizar texto intro
      const lineasIntro = pdf.splitTextToSize(introText, pageWidth - 2 * margin)
      pdf.text(lineasIntro, margin, yPos, { maxWidth: pageWidth - 2 * margin })
      yPos += lineasIntro.length * 5 + 10
      
      // Renderizar primera sección
      pdf.setFontSize(12)
      pdf.setFont('Inter', 'bold')
      const lineasTitulo = pdf.splitTextToSize(firstSection.titulo, pageWidth - 2 * margin)
      pdf.text(lineasTitulo, margin, yPos, { maxWidth: pageWidth - 2 * margin })
      yPos += lineasTitulo.length * 5 + 2
      
      pdf.setFont('Inter', 'normal')
      const lineasTexto = pdf.splitTextToSize(firstSection.texto, pageWidth - 2 * margin)
      pdf.text(lineasTexto, margin, yPos, { maxWidth: pageWidth - 2 * margin })
      yPos += lineasTexto.length * 5 + 10
      
      // Secciones restantes con títulos en bold
      const disclaimerSections = [
        {
          titulo: 'Gastos adicionales a cargo del usuario:',
          texto: 'Los gastos asociados a la propiedad del inmueble tales como impuestos prediales, seguro todo riesgo, cuotas de administración (ordinarias y extraordinarias), reparaciones y mantenimiento general, entre otros, serán pagados por el usuario de conformidad con los contratos del modelo de negocio acordado. Toperty se encargará únicamente del pago del seguro de arrendamiento.'
        },
        {
          titulo: 'Objetivo del programa:',
          texto: 'El presente plan de pagos está estructurado para que el usuario compre la vivienda al finalizar el programa con el porcentaje de participación indicado en este documento. Dependiendo del tipo de financiación que el usuario elija al finalizar el programa (leasing habitacional o crédito hipotecario), el porcentaje objetivo de adquisición y las condiciones del plan podrán ajustarse.'
        },
        {
          titulo: 'Valoración del inmueble:',
          texto: 'El presente plan de pagos está estructurado de acuerdo a las características del inmueble que el usuario seleccionó mediante el formato suministrado por Toperty en https://avaluo.toperty.co/. De haber alguna inconsistencia en la información suministrada, el plan de pagos podrá variar.'
        }
      ]
      
      for (const section of disclaimerSections) {
        // Calcular altura necesaria para esta sección
        const lineasTituloPreview = pdf.splitTextToSize(section.titulo, pageWidth - 2 * margin)
        const lineasTextoPreview = pdf.splitTextToSize(section.texto, pageWidth - 2 * margin)
        const sectionHeight = (lineasTituloPreview.length * 5 + 2) + (lineasTextoPreview.length * 5 + 10)
        
        // Check if we need a new page (leave 40mm for footer)
        if (yPos + sectionHeight > pageHeight - 40) {
          pdf.addPage()
          await addPageHeader()
          yPos = 60
        }
        
        // Título en bold
        pdf.setFontSize(12)
        pdf.setFont('Inter', 'bold')
        const lineasTitulo = pdf.splitTextToSize(section.titulo, pageWidth - 2 * margin)
        pdf.text(lineasTitulo, margin, yPos, { maxWidth: pageWidth - 2 * margin })
        yPos += lineasTitulo.length * 5 + 2
        
        // Texto normal
        pdf.setFont('Inter', 'normal')
        const lineasTexto = pdf.splitTextToSize(section.texto, pageWidth - 2 * margin)
        pdf.text(lineasTexto, margin, yPos, { maxWidth: pageWidth - 2 * margin })
        yPos += lineasTexto.length * 5 + 10
      }
      
      // Texto final - verificar espacio antes del footer (40mm)
      const finalText = `Este documento no representa una oferta vinculante para Toperty S.A.S., la cual está sujeta únicamente a que se completen todos los pasos del proceso. Toperty S.A.S. se reserva el derecho a dar por terminado el proceso en cualquier momento y bajo su absoluta discreción.`
      
      const lineasFinal = pdf.splitTextToSize(finalText, pageWidth - 2 * margin)
      const finalTextHeight = lineasFinal.length * 5 + 10
      
      // Verificar si cabe antes del footer (40mm de margen)
      if (yPos + finalTextHeight > pageHeight - 25) {
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      }
      
      pdf.text(lineasFinal, margin, yPos, { maxWidth: pageWidth - 2 * margin })
      yPos += lineasFinal.length + 15
      
      // PRÓXIMOS PASOS - Continúa en la misma página si hay espacio
      // Calcular si cabe el título + al menos el primer paso
      const firstStepHeight = 10 // Aproximado para título + primer paso
      if (yPos + firstStepHeight > pageHeight - 10) {
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      }
      
      // Separador visual antes de próximos pasos
      drawSectionSeparator(yPos)
      yPos += 10
      
      pdf.setFontSize(14)
      pdf.setFont('Inter', 'bold')
      pdf.setTextColor(...sectionTitleColor)
      pdf.text('Próximos pasos', margin, yPos)
      
      yPos += 12
      pdf.setFontSize(12)
      pdf.setFont('Inter', 'normal')
      pdf.setTextColor(...bodyTextColor)
      
      const proximospasos = [
        { titulo: '1. Aprueba Tu Plan De Pagos:', texto: 'Revisa detalladamente este plan de pagos y asegúrate de entender las cuotas mensuales, la duración del programa y la evolución del valor comercial del inmueble. Si estás de acuerdo con las condiciones, confírmale tu aprobación al asesor de Toperty que ha liderado tu proceso.' },
        { titulo: '2. Firma tu plan de pagos:', texto: 'Una vez confirmes la aprobación, te enviaremos un documento con la información del plan de pagos para que lo firmes digitalmente. Este documento formaliza tu aceptación de las condiciones del programa.' },
        { titulo: '3. Pago Del Fee De Entrada:', texto: 'Para que Toperty pueda iniciar la negociación formal con el propietario actual del inmueble, deberás realizar el pago del fee de entrada. Este pago nos permite proceder con la visita técnica al inmueble y la debida diligencia legal.' },
        { titulo: '4. Firma De Promesa De Compraventa Con El Propietario:', texto: 'Toperty firmará la promesa de compraventa con el propietario actual del inmueble. En este momento, deberás aportar la cuota inicial acordada en tu plan de pagos.' },
        { titulo: '5. Firma De Promesa De Compraventa Contigo:', texto: 'Firmaremos la promesa de compraventa entre Toperty y tú, donde quedarán establecidas las condiciones del programa Rent to Own, incluyendo el valor de compra futuro y los términos de tu participación.' },
        { titulo: '6. Escrituración Y Desembolso:', texto: 'Toperty procederá con la escrituración y desembolso para adquirir el inmueble. Una vez completado este proceso, el inmueble quedará a nombre de Toperty (o del vehículo constituido para tal fin).' },
        { titulo: '7. Entrega Del Inmueble Y Contrato De Arriendo:', texto: 'Recibirás las llaves de tu nueva vivienda y firmaremos el contrato de arrendamiento. Los pagos mensuales inician desde la fecha de entrega del inmueble. Si la entrega se realiza a mitad de mes, la cuota de ese primer mes se calculará de forma proporcional.' },
        { titulo: '8. Pagos Mensuales:', texto: 'Cada mes pagarás el canon de arrendamiento más el componente de compra parcial, además de los gastos operativos a tu cargo (administración, predial, seguro y mantenimiento).' },
        { titulo: '9. Monitorea Tu Progreso:', texto: 'Accede a tu dashboard personalizado para consultar tu porcentaje de participación, tiempo transcurrido y valor actualizado del inmueble.' },
        { titulo: '10. Gestión De Crédito:', texto: 'Antes de alcanzar tu porcentaje objetivo, te ayudaremos a gestionar tu crédito de vivienda o leasing habitacional.' },
        { titulo: '11. Transferencia Final:', texto: 'Una vez aprobado tu crédito, realizaremos la transferencia del inmueble a tu nombre. ¡Serás oficialmente propietario!' }
      ]
      
      for (const paso of proximospasos) {
        // Calcular altura necesaria para este paso
        const lineasTituloPreview = pdf.splitTextToSize(paso.titulo, pageWidth - 2 * margin)
        const lineasTextoPreview = pdf.splitTextToSize(paso.texto, pageWidth - 2 * margin)
        const pasoHeight = (lineasTituloPreview.length * 5) + (lineasTextoPreview.length * 5 + 10)
        
        // Check if we need a new page (leave 40mm for footer)
        if (yPos + pasoHeight > pageHeight - 40) {
          pdf.addPage()
          await addPageHeader()
          yPos = 60
        }
        
        // Título en bold
        pdf.setFontSize(12)
        pdf.setFont('Inter', 'bold')
        const lineasTitulo = pdf.splitTextToSize(paso.titulo, pageWidth - 2 * margin)
        pdf.text(lineasTitulo, margin, yPos, { maxWidth: pageWidth - 2 * margin })
        yPos += lineasTitulo.length * 5
        
        // Texto normal
        pdf.setFont('Inter', 'normal')
        const lineasTexto = pdf.splitTextToSize(paso.texto, pageWidth - 2 * margin)
        pdf.text(lineasTexto, margin, yPos, { maxWidth: pageWidth - 2 * margin })
        yPos += lineasTexto.length * 5 + 10
      }
      
      // FIRMAS al final de próximos pasos
      yPos += 25
      
      // Asegurar suficiente espacio para las firmas (necesitan ~60mm)
      if (yPos > pageHeight - 70) {
        pdf.addPage()
        await addPageHeader()
        yPos = 60
      }
      
      const clientName = dashboardData.data?.para_usuario?.client_name || 'N/A'
      const clientId = dashboardData.data?.para_usuario?.client_id || 'N/A'
      const coApplicantName = dashboardData.data?.para_usuario?.co_applicant_name
      const coApplicantId = dashboardData.data?.para_usuario?.co_applicant_id
      
      // Layout horizontal para todas las firmas
      const firmaBaseYPos = yPos
      const columnWidth = (pageWidth - 2 * margin) / 3
      const leftColumn = margin
      const centerColumn = margin + columnWidth
      const rightColumn = margin + 2 * columnWidth
      
      // Toperty (columna izquierda)
      pdf.setDrawColor(0, 24, 69) // Color #001845
      pdf.setLineWidth(0.3)
      pdf.line(leftColumn, yPos, leftColumn + columnWidth - 10, yPos)
      yPos += 8
      pdf.setFontSize(11)
      pdf.setFont('Inter', 'bold')
      pdf.text('Toperty S.A.S', leftColumn, yPos)
      pdf.setFont('Inter', 'normal')
      yPos += 6
      pdf.text('Nicolás Maldonado J.', leftColumn, yPos)
      yPos += 6
      pdf.text('Representante Legal', leftColumn, yPos)
      yPos += 6
      pdf.text('C.C. 1020758219', leftColumn, yPos)
      
      // Co-aplicante (columna central)
      let yPosCenter = firmaBaseYPos
      if (coApplicantName) {
        pdf.setDrawColor(0, 24, 69) // Color #001845
        pdf.setLineWidth(0.3)
        pdf.line(centerColumn, yPosCenter, centerColumn + columnWidth - 10, yPosCenter)
        yPosCenter += 8
        pdf.setFontSize(11)
        pdf.setFont('Inter', 'normal')
        pdf.text(`Nombre: ${coApplicantName}`, centerColumn, yPosCenter)
        yPosCenter += 6
        pdf.text('C.C. _______________', centerColumn, yPosCenter)
      } 
      
      // Cliente (columna derecha)
      let yPosRight = firmaBaseYPos
      
      pdf.setDrawColor(0, 24, 69) // Color #001845
      pdf.setLineWidth(0.3)
      pdf.line(rightColumn, yPosRight, rightColumn + columnWidth - 10, yPosRight)
      yPosRight += 8
      pdf.setFontSize(11)
      pdf.setFont('Inter', 'normal')
      pdf.text(`${clientName}`, rightColumn, yPosRight)
      yPosRight += 6
      pdf.text('C.C. _______________', rightColumn, yPosRight)

      
      // Asegurar que yPos sea el mayor de todas las columnas
      yPos = Math.max(yPos, yPosCenter, yPosRight) + 15
      
      // Agregar footers a todas las páginas
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        await addPageFooter()
      }
      
      pdf.save(`Plan_Pagos_${clientName?.replace(/\s+/g, '_') || 'Cliente'}_${new Date().toISOString().split('T')[0]}.pdf`)
      
      // Cerrar modal tras éxito
      setShowPaymentPlanForm(false)
      setSelectedValuation(null)
      
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el PDF. Por favor, intente nuevamente.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  // Cargar avalúos cuando cambien los filtros o la página
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadValuations()
    }, 500) // Debounce de 500ms para evitar múltiples llamadas
    
    return () => clearTimeout(timeoutId)
  }, [currentValuationsPage, filters, loadValuations]) // Incluir loadValuations
  
  // Resetear a página 1 cuando cambien los filtros (excepto en el montaje inicial)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setCurrentValuationsPage(1)
  }, [filters])
  
  // Sincronizar favoritos desde los datos cargados
  useEffect(() => {
    if (valuationsData?.valuations) {
      const favIds = valuationsData.valuations
        .filter(v => v.is_favorite)
        .sort((a, b) => (a.favorite_order || 0) - (b.favorite_order || 0))
        .map(v => v.id)
      setFavoriteValuations(favIds)
    }
  }, [valuationsData])
  
  // Sincronizar valores temporales de precio con los filtros
  useEffect(() => {
    setTempPriceMin(filters.priceMin)
    setTempPriceMax(filters.priceMax)
  }, [filters.priceMin, filters.priceMax])

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
    // Mostrar loading inmediatamente
    setLoadingPaymentPlanId(valuation.id)
    
    // Preparar datos del formulario con información del avalúo
    setSelectedValuation(valuation)
    
    // Check if dashboard already exists
    try {
      const checkResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/dashboard/check/${encodeURIComponent(valuation.valuation_name)}`)
      const dashboardCheck = await checkResponse.json()
      
      if (dashboardCheck.exists) {
        setLoadingPaymentPlanId(null) // Quitar loading antes de mostrar el modal
        // Dashboard exists, mostrar modal unificado
        setDashboardActionsModal({
          isOpen: true,
          title: 'Seleccione una acción',
          message: `Ya existe un plan de pagos para "${valuation.valuation_name}".\n\nDashboard válido por ${dashboardCheck.days_remaining} días.`,
          dashboardUrl: dashboardCheck.dashboard_url,
          sheetUrl: dashboardCheck.sheet_url,
          showEditButton: true,
          paymentPlanId: dashboardCheck.payment_plan_id || valuation.id
        })
        return // El modal maneja las acciones
      } else {
        // Dashboard doesn't exist, it's a new plan
        setIsEditingPaymentPlan(false)
      }
    } catch (error) {
      console.error('Error checking dashboard existence:', error)
      setIsEditingPaymentPlan(false)
      // Continuar para mostrar formulario de creación
    }
    
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
      // Configuración del Programa
      programa: '',
      valor_lanzamiento: 'descuento',
      tipo_programa: 'gradiente',
      tipo_vivienda: 'usada',
      alistamiento_acabados: 'no',
      financiacion_gastos: 'si',
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
      private_parking: valuation.garages?.toString() || '',
      // Co-aplicante - campos vacíos por defecto
      client_id: '',
      co_applicant_name: '',
      co_applicant_id: ''
    })
    setLoadingPaymentPlanId(null) // Quitar loading antes de mostrar el formulario
    setShowPaymentPlanForm(true)
  }


  // Función para convertir valor formateado a número
  const parseFormattedValue = (value: string) => {
    // Solo mantener números
    return value.replace(/[^0-9]/g, '')
  }

  // Función para formatear valores de entrada como moneda (redondeado)
  const formatInputValue = (value: string) => {
    if (!value) return ''
    // Solo limpiar y formatear lo que ya está guardado, no lo que se está escribiendo
    const numericValue = parseInt(value.replace(/[^0-9]/g, ''))
    if (isNaN(numericValue)) return ''
    return numericValue.toLocaleString('es-CO')
  }

  const handleClosePaymentPlanForm = () => {
    setShowPaymentPlanForm(false)
    setSelectedValuation(null)
    setIsEditingPaymentPlan(false)
    setPaymentPlanData({
      // Configuración del Programa
      programa: '',
      valor_lanzamiento: 'descuento',
      tipo_programa: 'gradiente',
      tipo_vivienda: 'usada',
      alistamiento_acabados: 'no',
      financiacion_gastos: 'si',
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
      private_parking: '',
      // Co-aplicante
      client_id: '',
      co_applicant_name: '',
      co_applicant_id: ''
    })
  }

  // Función para abrir el formulario de edición desde el modal de plan existente
  const handleEditPlanFromModal = async () => {
    if (!selectedValuation) return
    
    setDashboardActionsModal(prev => ({ ...prev, isOpen: false }))
    setIsEditingPaymentPlan(true)
    
    // Obtener dirección y ciudad desde coordenadas si están disponibles
    let resolvedAddress = address || ''
    let resolvedCity = ''
    let resolvedCountry = 'Colombia'
    
    if (selectedValuation.latitude && selectedValuation.longitude && !address) {
      try {
        const result = await reverseGeocode(selectedValuation.latitude, selectedValuation.longitude)
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
      // Configuración del Programa
      programa: '',
      valor_lanzamiento: 'descuento',
      tipo_programa: 'gradiente',
      tipo_vivienda: 'usada',
      alistamiento_acabados: 'no',
      financiacion_gastos: 'si',
      // Flujo Toperty Interno
      area: selectedValuation.area.toString(),
      commercial_value: selectedValuation.final_price?.toString() || '',
      average_purchase_value: '',
      asking_price: '',
      user_down_payment: '',
      program_months: '',
      potential_down_payment: '',
      bank_mortgage_rate: '',
      dupla_bank_rate: '',
      // Para Envío Usuario
      client_name: '',
      address: resolvedAddress,
      city: resolvedCity,
      country: resolvedCountry,
      construction_year: '',
      stratum: selectedValuation.stratum?.toString() || '',
      apartment_type: '',
      private_parking: selectedValuation.garages?.toString() || '',
      // Co-aplicante
      client_id: '',
      co_applicant_name: '',
      co_applicant_id: ''
    })
    setShowPaymentPlanForm(true)
  }

  const handlePaymentPlanChange = (field: string, value: string) => {
    const priceFields = ['average_purchase_value', 'asking_price', 'user_down_payment']
    
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
    } else if (field === 'potential_down_payment' || field === 'bank_mortgage_rate' || field === 'dupla_bank_rate') {
      // Para campos de porcentaje, manejar números decimales
      const numericValue = value.replace(/[^0-9.]/g, '')
      setPaymentPlanData(prev => ({
        ...prev,
        [field]: numericValue
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
    
    // Mapeo de programa a template_sheet_id de Google Sheets
    const programaTemplates: Record<string, string> = {
      'programa_1': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_GENERAL || '',
      'programa_2': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_SOLE || '',
      'programa_3': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_B75 || '',
      'programa_4': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_D89 || '',
      'programa_5': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_C84 || '',
      'programa_6': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_A68 || '',
      'programa_7': process.env.NEXT_PUBLIC_TEMPLATE_PROGRAMA_ALUNA || '',
    }

    const templateSheetId = programaTemplates[paymentPlanData.programa]
    if (!templateSheetId) {
      alert('No se encontró el template para el programa seleccionado. Verifique la configuración.')
      return
    }
    
    try {
      setSaving(true) // Usar estado existente
      
      // Preparar datos para envío, agregando % a los campos de porcentaje
      const dataToSend = {
        ...paymentPlanData,
        valuation_name: selectedValuation?.valuation_name || paymentPlanData.client_name, // Usar nombre del avalúo
        template_sheet_id: templateSheetId, // ID del template de Google Sheets
        potential_down_payment: paymentPlanData.potential_down_payment ? `${paymentPlanData.potential_down_payment}%` : '',
        bank_mortgage_rate: paymentPlanData.bank_mortgage_rate ? `${paymentPlanData.bank_mortgage_rate}%` : '',
        dupla_bank_rate: paymentPlanData.dupla_bank_rate ? `${paymentPlanData.dupla_bank_rate}%` : ''
      }
      
      // Llamar al endpoint de Google Sheets
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/google-sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        // Éxito - mostrar modal persistente con opciones
        const successTitle = isEditingPaymentPlan 
          ? '¡Plan de Pagos Editado!' 
          : '¡Plan de Pagos Creado!'
        const successMessage = isEditingPaymentPlan 
          ? '¡Plan de pagos editado exitosamente!' 
          : '¡Plan de pagos creado exitosamente!'
        setDashboardActionsModal({
          isOpen: true,
          title: successTitle,
          message: result.message || successMessage,
          dashboardUrl: result.dashboard_url || null,
          sheetUrl: result.sheet_url || null,
          showEditButton: false,
          paymentPlanId: result.payment_plan_id || null
        })
        
        // Recargar la tabla de valuations para actualizar el estado del botón
        loadValuations()
        
        // Cerrar el formulario de plan de pagos
        setShowPaymentPlanForm(false)
        setSelectedValuation(null)
        // No resetear isEditingPaymentPlan aquí - se hace al cerrar el modal
        
      } else {
        // Error del servidor
        setSaveMessage({
          type: 'error',
          text: result.detail || 'Error al crear el plan de pagos'
        })
      }
      
    } catch (error) {
      console.error('Error al enviar plan de pagos:', error)
      setSaveMessage({
        type: 'error',
        text: 'Error de conexión. Intente nuevamente.'
      })
    } finally {
      setSaving(false)
    }
  }


  const handleInvestorPDF = (valuation: Valuation) => {
    setSelectedInvestorValuation(valuation)
    setShowInvestorPresentationForm(true)
  }

  const handleInvestorPDFComplete = async () => {
    // La presentación ya se genera dentro del formulario InvestorPresentationForm
    // Solo cerramos el modal aquí
    setShowInvestorPresentationForm(false)
    setSelectedInvestorValuation(null)
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
  
  // Funciones para manejar favoritos
  const toggleFavorite = async (valuationId: number, replaceId?: number) => {
    // Prevenir múltiples clicks
    if (updatingFavorite !== null) return
    
    setUpdatingFavorite(valuationId)
    
    try {
      const wasInFavorites = favoriteValuations.includes(valuationId)
      
      if (!wasInFavorites) {
        // Si hay 5 favoritos y no se especificó cuál reemplazar, mostrar modal
        if (favoriteValuations.length >= 5 && !replaceId) {
          setShowFavoriteReplace(valuationId)
          setUpdatingFavorite(null)
          return
        }
        
        // Si hay un ID para reemplazar, primero remover ese
        if (replaceId) {
          await toggleValuationFavorite(replaceId) // Desmarcar el anterior
        }
      }
      
      // Llamar a la API para el favorito principal
      const result = await toggleValuationFavorite(valuationId)
      
      if (result.status === 'error') {
        setSaveMessage({
          type: 'error',
          text: result.message
        })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        // Recargar todos los datos para asegurar sincronización
        await loadValuations()
      }
      
      // Cerrar el modal si estaba abierto
      setShowFavoriteReplace(null)
    } finally {
      setUpdatingFavorite(null)
    }
  }

  // Los filtros ahora se aplican en el backend, no necesitamos filtrar en frontend

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
      const response = await fetch(`${API_BASE_URL}/api/valuation`, {
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
    // Manejar envío del formulario - llamar a calcular avalúo
    if (!loading) {
      handleCalculateValuation()
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
      
      {/* Mensaje global de estado */}
      {saveMessage && (
        <div className={`p-4 rounded-lg text-center font-medium ${
          saveMessage.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Overlay de generación de PDF - Bloquea toda la UI */}
      {generatingPDF && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Generando PDF</h3>
              <p className="text-sm text-gray-500 mt-1">Por favor espere, el archivo se descargará automáticamente...</p>
            </div>
          </div>
        </div>
      )}
      
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
                type="submit" 
                className="w-full transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100 disabled:hover:shadow-none" 
                disabled={loading}
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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Avalúos
              {favoriteValuations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  <Pin className="h-3 w-3 mr-1" />
                  {favoriteValuations.length}/5
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </Button>
          </CardTitle>
          <CardDescription>
            Lista de todos los avalúos realizados ordenados del más reciente al más antiguo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sección de filtros */}
          {showFilters && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="filter-name">Buscar por nombre</Label>
                  <Input
                    id="filter-name"
                    placeholder="Nombre del avalúo..."
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="filter-date-from">Fecha desde</Label>
                  <Input
                    id="filter-date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="filter-date-to">Fecha hasta</Label>
                  <Input
                    id="filter-date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="filter-type">Tipo de propiedad</Label>
                  <Select 
                    value={filters.propertyType || "all"} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, propertyType: value === "all" ? '' : value }))}
                  >
                    <SelectTrigger id="filter-type">
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      {propertyTypes.map(type => (
                        <SelectItem key={type.value} value={type.value.toString()}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-price-min">Precio mínimo</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="filter-price-min"
                      type="text"
                      placeholder="0"
                      className="pl-7"
                      value={formatPriceInput(tempPriceMin || filters.priceMin)}
                      onChange={(e) => {
                        const numericValue = getPriceValue(e.target.value)
                        if (/^\d*$/.test(numericValue)) {
                          setTempPriceMin(numericValue)
                        }
                      }}
                      onBlur={() => {
                        setFilters(prev => ({ ...prev, priceMin: tempPriceMin }))
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setFilters(prev => ({ ...prev, priceMin: tempPriceMin }))
                          e.currentTarget.blur()
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="filter-price-max">Precio máximo</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="filter-price-max"
                      type="text"
                      placeholder="Sin límite"
                      className="pl-7"
                      value={formatPriceInput(tempPriceMax || filters.priceMax)}
                      onChange={(e) => {
                        const numericValue = getPriceValue(e.target.value)
                        if (/^\d*$/.test(numericValue)) {
                          setTempPriceMax(numericValue)
                        }
                      }}
                      onBlur={() => {
                        setFilters(prev => ({ ...prev, priceMax: tempPriceMax }))
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setFilters(prev => ({ ...prev, priceMax: tempPriceMax }))
                          e.currentTarget.blur()
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilters({
                      propertyType: '',
                      dateFrom: '',
                      dateTo: '',
                      priceMin: '',
                      priceMax: '',
                      searchName: ''
                    })
                    setTempPriceMin('')
                    setTempPriceMax('')
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          )}
          <div className="border rounded-lg w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
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
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          Cargando avalúos...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : valuationsData?.valuations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {filters.searchName || filters.propertyType || filters.dateFrom || filters.dateTo || filters.priceMin || filters.priceMax
                          ? 'No se encontraron avalúos con los filtros aplicados'
                          : 'No hay avalúos guardados aún'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    valuationsData?.valuations.map((valuation) => (
                      <TableRow key={valuation.id} className={favoriteValuations.includes(valuation.id) ? 'bg-yellow-50' : ''}>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFavorite(valuation.id)}
                                disabled={updatingFavorite !== null}
                                className={`p-1 hover:bg-transparent ${
                                  favoriteValuations.includes(valuation.id)
                                    ? 'text-yellow-600'
                                    : 'text-gray-400 hover:text-gray-600'
                                } ${
                                  updatingFavorite === valuation.id ? 'opacity-50' : ''
                                }`}
                              >
                                <Pin 
                                  className="h-4 w-4" 
                                  fill={favoriteValuations.includes(valuation.id) ? 'currentColor' : 'none'}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {favoriteValuations.includes(valuation.id) 
                                  ? 'Quitar de favoritos' 
                                  : `Marcar como favorito (${favoriteValuations.length}/5)`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
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
                              className="w-24 flex items-center justify-center gap-1 transition-all duration-200 hover:scale-105 hover:shadow-md"
                            >
                              <Edit className="h-3 w-3" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePaymentPlan(valuation)}
                              disabled={loadingPaymentPlanId === valuation.id}
                              className={`w-36 flex items-center justify-center gap-1 transition-all duration-200 hover:scale-105 hover:shadow-md ${
                                valuation.has_payment_plan 
                                  ? 'border-blue-800 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:border-blue-900' 
                                  : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                              }`}
                            >
                              {loadingPaymentPlanId === valuation.id ? (
                                <>
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Cargando...
                                </>
                              ) : (
                                <>
                                  <FileText className="h-3 w-3" />
                                  {valuation.has_payment_plan ? 'Ver plan' : 'Crear plan'}
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInvestorPDF(valuation)}
                              className="w-32 flex items-center justify-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-200 hover:scale-105 hover:shadow-md"
                            >
                              <FileText className="h-3 w-3" />
                              PDF Inversionista
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteValuation(valuation)}
                              className="w-24 flex items-center justify-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 hover:scale-105 hover:shadow-md"
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
            {/* Subtítulo: Configuración del Programa */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Configuración del Programa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="programa" className="cursor-help">Programa *</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Seleccione el programa de financiación</p>
                    </TooltipContent>
                  </Tooltip>
                  {/* Input para validación nativa del formulario - posicionado detrás del Select */}
                  <input
                    type="text"
                    value={paymentPlanData.programa}
                    onChange={() => {}}
                    required
                    className="absolute inset-0 top-6 opacity-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <Select
                    value={paymentPlanData.programa}
                    onValueChange={(value) => handlePaymentPlanChange('programa', value)}
                    required
                  >
                    <SelectTrigger id="programa">
                      <SelectValue placeholder="Seleccione un programa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="programa_1">Programa Toperty General</SelectItem>
                      <SelectItem value="programa_2">Solé (C. Bolivar)</SelectItem>
                      <SelectItem value="programa_3">Austro (C. Bolivar) - B75</SelectItem>
                      <SelectItem value="programa_4">Austro (C. Bolivar) - D89</SelectItem>
                      <SelectItem value="programa_5">Austro (C. Bolivar) - C84</SelectItem>
                      <SelectItem value="programa_6">Austro (C. Bolivar) - A68</SelectItem>
                      <SelectItem value="programa_7">Aluna (Coninsa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="valor_lanzamiento" className="cursor-help">Valor de Lanzamiento</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Tipo de valor para el lanzamiento</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={paymentPlanData.valor_lanzamiento}
                    onValueChange={(value) => handlePaymentPlanChange('valor_lanzamiento', value)}
                  >
                    <SelectTrigger id="valor_lanzamiento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="descuento">Descuento</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="tipo_programa" className="cursor-help">Tipo de Programa</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Estructura del programa de pagos</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={paymentPlanData.tipo_programa}
                    onValueChange={(value) => handlePaymentPlanChange('tipo_programa', value)}
                  >
                    <SelectTrigger id="tipo_programa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lineal">Lineal</SelectItem>
                      <SelectItem value="gradiente">Gradiente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="tipo_vivienda" className="cursor-help">Tipo de Vivienda</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Condición de la vivienda</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={paymentPlanData.tipo_vivienda}
                    onValueChange={(value) => handlePaymentPlanChange('tipo_vivienda', value)}
                  >
                    <SelectTrigger id="tipo_vivienda">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nueva">Nueva</SelectItem>
                      <SelectItem value="usada">Usada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="alistamiento_acabados" className="cursor-help">
                        {paymentPlanData.programa === 'programa_1' || paymentPlanData.programa === 'programa_7' 
                          ? 'Con Alistamiento en la Entrega' 
                          : 'Con Acabados a la Entrega'}
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>{paymentPlanData.programa === 'programa_1' || paymentPlanData.programa === 'programa_7'
                        ? 'Si la propiedad incluye alistamiento en la entrega'
                        : 'Si la propiedad incluye acabados a la entrega'}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={paymentPlanData.alistamiento_acabados}
                    onValueChange={(value) => handlePaymentPlanChange('alistamiento_acabados', value)}
                  >
                    <SelectTrigger id="alistamiento_acabados">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Si">Sí</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="financiacion_gastos" className="cursor-help">Con Financiación de Gastos de Cierre</Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5} align="center">
                      <p>Si incluye financiación para los gastos de cierre</p>
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={paymentPlanData.financiacion_gastos}
                    onValueChange={(value) => handlePaymentPlanChange('financiacion_gastos', value)}
                  >
                    <SelectTrigger id="financiacion_gastos">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Si">Sí</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

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
                    <Label htmlFor="potential_down_payment" className="cursor-help">Objetivo de Adquisición</Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} align="center">
                    <p>Objetivo de adquisición después del programa</p>
                  </TooltipContent>
                </Tooltip>
                <div className="relative">
                  <Input
                    id="potential_down_payment"
                    type="text"
                    value={paymentPlanData.potential_down_payment}
                    onChange={(e) => handlePaymentPlanChange('potential_down_payment', e.target.value)}
                    placeholder="Ej: 15"
                    className="pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                </div>
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
                    <Label htmlFor="dupla_bank_rate" className="cursor-help">Tasa Duppla (%)</Label>
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
                disabled={saving}
                className="flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                <FileText className="h-4 w-4" />
                {saving 
                  ? (isEditingPaymentPlan ? 'Editando Plan...' : 'Creando Plan...') 
                  : (isEditingPaymentPlan ? 'Editar Plan de Pagos' : 'Generar Plan de Pagos')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal persistente para acciones del dashboard */}
      <Dialog open={dashboardActionsModal.isOpen} onOpenChange={(open) => {
        if (!open && !generatingPDFInModal) {
          setDashboardActionsModal(prev => ({ ...prev, isOpen: false }))
          setIsEditingPaymentPlan(false)
        }
      }}>
        <DialogContent 
          className="sm:max-w-lg [&>button.absolute]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Overlay de loading para PDF */}
          {generatingPDFInModal && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50 rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium text-gray-700">Generando PDF...</span>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {dashboardActionsModal.title || '¡Plan de Pagos Creado!'}
            </DialogTitle>
            <DialogDescription>
              {dashboardActionsModal.message}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 py-4">
            <div className="text-sm text-gray-500 mb-2">Acciones disponibles:</div>
            <div className="space-y-1">
              {dashboardActionsModal.dashboardUrl && (
                <>
                  <button
                    onClick={() => window.open(`${dashboardActionsModal.dashboardUrl}/user`, '_blank')}
                    disabled={generatingPDFInModal}
                    className="w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium">Ver Dashboard Usuario</span>
                    <span className="text-gray-400 group-hover:text-gray-600">→</span>
                  </button>
                  <button
                    onClick={() => window.open(`${dashboardActionsModal.dashboardUrl}/investor`, '_blank')}
                    disabled={generatingPDFInModal}
                    className="w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium">Ver Dashboard Inversionista</span>
                    <span className="text-gray-400 group-hover:text-gray-600">→</span>
                  </button>
                </>
              )}
              {dashboardActionsModal.sheetUrl && (
                <button
                  onClick={() => window.open(dashboardActionsModal.sheetUrl!, '_blank')}
                  disabled={generatingPDFInModal}
                  className="w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium">Ver Excel</span>
                  <span className="text-gray-400 group-hover:text-gray-600">→</span>
                </button>
              )}
              {dashboardActionsModal.dashboardUrl && (
                <button
                  onClick={() => {
                    setGeneratingPDFInModal(true)
                    generatePDFFromModal(dashboardActionsModal.dashboardUrl!)
                      .then(() => {
                        setSaveMessage({
                          type: 'success',
                          text: '✅ PDF generado exitosamente y descargado.'
                        })
                        setTimeout(() => setSaveMessage(null), 3000)
                      })
                      .catch(() => {
                        setSaveMessage({
                          type: 'error',
                          text: '❌ Error al generar el PDF. Intente nuevamente.'
                        })
                        setTimeout(() => setSaveMessage(null), 5000)
                      })
                      .finally(() => setGeneratingPDFInModal(false))
                  }}
                  disabled={generatingPDFInModal}
                  className="w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium">PDF Usuario</span>
                  <span className="text-gray-400 group-hover:text-gray-600">→</span>
                </button>
              )}
              {dashboardActionsModal.showEditButton && (
                <button
                  onClick={handleEditPlanFromModal}
                  disabled={generatingPDFInModal}
                  className="w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group bg-amber-50 hover:bg-amber-100 text-amber-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium">Editar Plan</span>
                  <span className="text-amber-400 group-hover:text-amber-600">→</span>
                </button>
              )}
              <button
                onClick={() => setApprovalLetterModal({ isOpen: true, paymentPlanId: dashboardActionsModal.paymentPlanId })}
                disabled={generatingPDFInModal}
                className="w-full text-left px-4 py-3 rounded-md transition-colors flex items-center justify-between group bg-green-50 hover:bg-green-100 text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="font-medium">Generar Carta de Aprobación</span>
                <span className="text-green-400 group-hover:text-green-600">→</span>
              </button>
            </div>
            {/* Botón de cerrar separado */}
            <div className="mt-2 pt-2 border-t">
              <button
                onClick={() => setDashboardActionsModal(prev => ({ ...prev, isOpen: false }))}
                disabled={generatingPDFInModal}
                className="w-full px-4 py-2 rounded-md font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cerrar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Carta de Aprobación */}
      <Dialog open={approvalLetterModal.isOpen} onOpenChange={(open) => {
        if (!open && !generatingApprovalLetter) {
          setApprovalLetterModal({ isOpen: false, paymentPlanId: null })
          setApprovalLetterForm({
            fullName: '',
            idType: '',
            idNumber: '',
            maxApprovedAmount: '',
            minInitialPayment: '',
            hasSecondaryClient: false,
            secondaryFullName: '',
            secondaryIdType: '',
            secondaryIdNumber: ''
          })
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Overlay de loading para generar carta - igual que PDF */}
          {generatingApprovalLetter && (
            <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">Generando carta de aprobación</h3>
                  <p className="text-sm text-gray-500 mt-1">Por favor espere, se abrirá en una nueva pestaña...</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogHeader>
            <DialogTitle>Generar Carta de Aprobación</DialogTitle>
            <DialogDescription>
              Complete la información necesaria para generar la carta de aprobación del crédito
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Cliente Principal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cliente Principal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Nombre Completo *</Label>
                  <Input
                    id="fullName"
                    value={approvalLetterForm.fullName}
                    onChange={(e) => setApprovalLetterForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Nombre completo del cliente"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="idType">Tipo de Identificación *</Label>
                    <Select 
                      value={approvalLetterForm.idType} 
                      onValueChange={(value) => setApprovalLetterForm(prev => ({ ...prev, idType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">Cédula de Ciudadanía (C.C.)</SelectItem>
                        <SelectItem value="TI">Tarjeta de Identidad (T.I.)</SelectItem>
                        <SelectItem value="CE">Cédula de Extranjería (C.E.)</SelectItem>
                        <SelectItem value="PA">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="idNumber">Número de Identificación *</Label>
                    <Input
                      id="idNumber"
                      value={approvalLetterForm.idNumber}
                      onChange={(e) => setApprovalLetterForm(prev => ({ ...prev, idNumber: e.target.value }))}
                      placeholder="Número de identificación"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxApprovedAmount">Cupo Máximo Aprobado *</Label>
                    <Input
                      id="maxApprovedAmount"
                      value={approvalLetterForm.maxApprovedAmount}
                      onChange={(e) => {
                        const formatted = formatNumberWithThousands(e.target.value)
                        setApprovalLetterForm(prev => ({ ...prev, maxApprovedAmount: formatted }))
                      }}
                      placeholder="Ej: 500.000.000"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="minInitialPayment">Cuota Inicial Mínima *</Label>
                    <Input
                      id="minInitialPayment"
                      value={approvalLetterForm.minInitialPayment}
                      onChange={(e) => {
                        const formatted = formatNumberWithThousands(e.target.value)
                        setApprovalLetterForm(prev => ({ ...prev, minInitialPayment: formatted }))
                      }}
                      placeholder="Ej: 150.000.000"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cliente Secundario */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={approvalLetterForm.hasSecondaryClient}
                    onChange={(e) => setApprovalLetterForm(prev => ({ 
                      ...prev, 
                      hasSecondaryClient: e.target.checked,
                      secondaryFullName: e.target.checked ? prev.secondaryFullName : '',
                      secondaryIdType: e.target.checked ? prev.secondaryIdType : '',
                      secondaryIdNumber: e.target.checked ? prev.secondaryIdNumber : ''
                    }))}
                    className="rounded border-gray-300"
                  />
                  Cliente Secundario
                </CardTitle>
                <CardDescription>
                  Marque la casilla si existe un cliente secundario
                </CardDescription>
              </CardHeader>
              
              {approvalLetterForm.hasSecondaryClient && (
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="secondaryFullName">Nombre Completo *</Label>
                    <Input
                      id="secondaryFullName"
                      value={approvalLetterForm.secondaryFullName}
                      onChange={(e) => setApprovalLetterForm(prev => ({ ...prev, secondaryFullName: e.target.value }))}
                      placeholder="Nombre completo del cliente secundario"
                      required={approvalLetterForm.hasSecondaryClient}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="secondaryIdType">Tipo de Identificación *</Label>
                      <Select 
                        value={approvalLetterForm.secondaryIdType} 
                        onValueChange={(value) => setApprovalLetterForm(prev => ({ ...prev, secondaryIdType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">Cédula de Ciudadanía (C.C.)</SelectItem>
                          <SelectItem value="TI">Tarjeta de Identidad (T.I.)</SelectItem>
                          <SelectItem value="CE">Cédula de Extranjería (C.E.)</SelectItem>
                          <SelectItem value="PA">Pasaporte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="secondaryIdNumber">Número de Identificación *</Label>
                      <Input
                        id="secondaryIdNumber"
                        value={approvalLetterForm.secondaryIdNumber}
                        onChange={(e) => setApprovalLetterForm(prev => ({ ...prev, secondaryIdNumber: e.target.value }))}
                        placeholder="Número de identificación"
                        required={approvalLetterForm.hasSecondaryClient}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setApprovalLetterModal({ isOpen: false, paymentPlanId: null })}
              disabled={generatingApprovalLetter}
            >
              Cancelar
            </Button>
            <div className="flex items-center">
              <Button 
                onClick={handleGenerateApprovalLetter}
                disabled={
                  generatingApprovalLetter || 
                  !approvalLetterForm.fullName || 
                  !approvalLetterForm.idType || 
                  !approvalLetterForm.idNumber || 
                  !approvalLetterForm.maxApprovedAmount || 
                  !approvalLetterForm.minInitialPayment ||
                  (approvalLetterForm.hasSecondaryClient && (!approvalLetterForm.secondaryFullName || !approvalLetterForm.secondaryIdType || !approvalLetterForm.secondaryIdNumber))
                }
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  (!approvalLetterForm.fullName || !approvalLetterForm.idType || !approvalLetterForm.idNumber || !approvalLetterForm.maxApprovedAmount || !approvalLetterForm.minInitialPayment) ?
                  'Complete todos los campos del cliente principal' :
                  (approvalLetterForm.hasSecondaryClient && (!approvalLetterForm.secondaryFullName || !approvalLetterForm.secondaryIdType || !approvalLetterForm.secondaryIdNumber)) ?
                  'Complete todos los campos del cliente secundario' : 
                  ''
                }
              >
                {generatingApprovalLetter ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generando...
                  </>
                ) : (
                  'Generar Carta de Aprobación'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de PDF para Inversionistas */}
      {selectedInvestorValuation && (
        <InvestorPresentationForm
          valuationId={selectedInvestorValuation.id}
          valuationName={selectedInvestorValuation.valuation_name}
          isOpen={showInvestorPresentationForm}
          onClose={() => {
            setShowInvestorPresentationForm(false)
            setSelectedInvestorValuation(null)
          }}
          onComplete={handleInvestorPDFComplete}
        />
      )}
      
      {/* Modal para reemplazar favorito */}
      <Dialog open={showFavoriteReplace !== null} onOpenChange={() => setShowFavoriteReplace(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pin className="h-5 w-5 text-yellow-600" />
              Límite de favoritos alcanzado
            </DialogTitle>
            <DialogDescription>
              Ya tienes 5 favoritos marcados (máximo permitido). 
              Selecciona cuál deseas reemplazar con el nuevo favorito.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 my-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Favoritos actuales:
            </div>
            {valuationsData?.valuations
              .filter(v => favoriteValuations.includes(v.id))
              .sort((a, b) => (a.favorite_order || 0) - (b.favorite_order || 0))
              .map(valuation => (
                <div 
                  key={valuation.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    updatingFavorite === null ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (updatingFavorite === null) {
                      toggleFavorite(showFavoriteReplace!, valuation.id)
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{valuation.valuation_name}</div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(valuation.final_price)} - {new Date(valuation.created_at).toLocaleDateString('es-CO')}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={updatingFavorite !== null}
                    >
                      {updatingFavorite === showFavoriteReplace ? 'Actualizando...' : 'Reemplazar'}
                    </Button>
                  </div>
                </div>
              ))
            }
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFavoriteReplace(null)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}