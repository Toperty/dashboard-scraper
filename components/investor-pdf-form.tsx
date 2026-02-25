"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, DollarSign, FileText, Home, Image, User, AlertCircle, Check, Upload, X, Trash2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

interface InvestorPresentationFormProps {
  valuationId: number
  valuationName: string
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

interface TenantInfo {
  monthly_income: number
  monthly_payment: number
  employer: string
  credit_score: number
  score_date: string
}

interface ValuationData {
  description: string
  floor?: number  // Piso del inmueble
  administration_fee?: number  // Cuota de administración -> {{administracion}}
  // Campos de solo lectura (vienen del Excel, no se guardan)
  purchase_price?: number
  closing_costs?: number
  user_down_payment?: number
  total_investment?: number
}

interface PropertyImage {
  id?: number
  file?: File
  caption: string
  preview?: string
  uploaded?: boolean  // Flag para rastrear si ya se subió
  image_path?: string // Path de la imagen ya subida
}

export function InvestorPresentationForm({ valuationId, valuationName, isOpen, onClose, onComplete }: InvestorPresentationFormProps) {
  const [activeTab, setActiveTab] = useState("description")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [generatingPresentation, setGeneratingPresentation] = useState(false)
  const { showToast } = useToast()
  
  // Función para formatear números con separador de miles
  const formatNumber = (value: number | string) => {
    if (value === '' || value === null || value === undefined) return ''
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
    if (isNaN(num)) return ''
    if (num === 0) return ''
    return new Intl.NumberFormat('es-CO').format(num)
  }
  
  
  // Estados para cada sección
  const [valuationData, setValuationData] = useState<ValuationData>({
    description: "",
    floor: undefined,
    administration_fee: undefined,
    purchase_price: 0,
    closing_costs: 0,
    user_down_payment: 0,
    total_investment: 0
  })
  
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({
    monthly_income: 0,
    monthly_payment: 0,
    employer: "",
    credit_score: 0,
    score_date: new Date().toISOString().split('T')[0]
  })
  
  const [images, setImages] = useState<PropertyImage[]>([])
  const [facadeImage, setFacadeImage] = useState<PropertyImage | null>(null) // Imagen de Fachada
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Cargar datos existentes al abrir
  useEffect(() => {
    if (isOpen && valuationId) {
      loadExistingData()
      loadFinancialDataFromExcel()
    }
  }, [isOpen, valuationId])

  // Bloquear scroll del body cuando se está generando
  useEffect(() => {
    if (generatingPresentation) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup al desmontar
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [generatingPresentation])

  const loadExistingData = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/data/${valuationId}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.data.valuation) {
          setValuationData({
            description: data.data.valuation.description || "",
            floor: data.data.valuation.floor || undefined,
            administration_fee: data.data.valuation.administration_fee || undefined
          })
        }
        if (data.data.tenant_info) {
          setTenantInfo({
            monthly_income: data.data.tenant_info.monthly_income || 0,
            monthly_payment: data.data.tenant_info.monthly_payment || 0,
            employer: data.data.tenant_info.employer || "",
            credit_score: data.data.tenant_info.credit_score || 0,
            score_date: data.data.tenant_info.score_date?.split('T')[0] || new Date().toISOString().split('T')[0]
          })
        }
        if (data.data.images) {
          // Separar imagen de fachada de las demás
          const facadeImg = data.data.images.find((img: any) => img.is_facade === true)
          const regularImages = data.data.images.filter((img: any) => !img.is_facade)
          
          // Cargar imágenes regulares (máximo 6)
          setImages(regularImages.slice(0, 6).map((img: any) => {
            // Si es una URL de GCS, usar el proxy
            let displayUrl = img.image_path
            if (img.image_path && (img.image_path.startsWith('http') || img.image_path.startsWith('/uploads'))) {
              displayUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/images/proxy?url=${encodeURIComponent(img.image_path)}`
            }
            
            return {
              id: img.id,
              caption: img.caption || "",
              preview: displayUrl,
              image_path: img.image_path,
              uploaded: true  // Las imágenes existentes ya están subidas
            }
          }))
          
          // Cargar imagen de fachada si existe
          if (facadeImg) {
            let displayUrl = facadeImg.image_path
            if (facadeImg.image_path && (facadeImg.image_path.startsWith('http') || facadeImg.image_path.startsWith('/uploads'))) {
              displayUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/images/proxy?url=${encodeURIComponent(facadeImg.image_path)}`
            }
            
            setFacadeImage({
              id: facadeImg.id,
              caption: "Fachada",
              preview: displayUrl,
              image_path: facadeImg.image_path,
              uploaded: true
            })
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const calculateRatios = () => {
    // Los ratios se calculan automáticamente en el backend
    // Esta función se mantiene para el onBlur de los campos
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Verificar si ya tenemos 6 imágenes
    if (images.length >= 6) {
      showToast("Ya has alcanzado el límite máximo de 6 imágenes", "info")
      return
    }
    
    // Calcular cuántas imágenes podemos agregar
    const remainingSlots = 6 - images.length
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      showToast(`Solo se pueden agregar ${remainingSlots} imagen${remainingSlots === 1 ? '' : 'es'} más. Límite máximo: 6 imágenes`, "info")
    }
    
    const newImages = filesToAdd.map(file => ({
      file,
      caption: "",
      preview: URL.createObjectURL(file)
    }))
    setImages(prev => [...prev, ...newImages].slice(0, 6)) // Máximo 6 imágenes
  }

  const handleFacadeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setFacadeImage({
      file,
      caption: "Fachada",
      preview: URL.createObjectURL(file)
    })
  }

  const removeFacadeImage = async () => {
    const imageToRemove = facadeImage
    
    // Si la imagen tiene ID, significa que está en el backend y debe eliminarse
    if (imageToRemove?.id) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/images/${imageToRemove.id}`,
          { method: 'DELETE' }
        )
        
        if (!response.ok) {
          console.error('Error al eliminar la imagen de fachada del backend')
        }
      } catch (error) {
        console.error('Error al eliminar la imagen de fachada:', error)
      }
    }
    
    // Limpiar el preview si existe
    if (imageToRemove?.preview && imageToRemove.preview.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.preview)
    }
    
    setFacadeImage(null)
  }

  const removeImage = async (index: number) => {
    const imageToRemove = images[index]
    
    // Si la imagen tiene ID, significa que está en el backend y debe eliminarse
    if (imageToRemove.id) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/images/${imageToRemove.id}`,
          { method: 'DELETE' }
        )
        if (!response.ok) {
          console.error('Error deleting image from backend')
          return
        }
      } catch (error) {
        console.error('Error deleting image:', error)
        return
      }
    }
    
    // Eliminar del estado local
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const validateForm = async () => {
    setValidating(true)
    const missingFields: string[] = []
    
    try {
      // Validación local de todos los campos del formulario
      
      // Pestaña Descripción
      if (!valuationData.description || valuationData.description.trim() === '') {
        missingFields.push('Descripción del inmueble')
      }
      if (valuationData.floor === undefined || valuationData.floor === null) {
        missingFields.push('Piso')
      }
      if (!valuationData.administration_fee || valuationData.administration_fee <= 0) {
        missingFields.push('Cuota de Administración')
      }
      
      // Pestaña Inquilino
      if (!tenantInfo.monthly_income || tenantInfo.monthly_income <= 0) {
        missingFields.push('Ingresos Mensuales Certificados')
      }
      if (!tenantInfo.monthly_payment || tenantInfo.monthly_payment <= 0) {
        missingFields.push('Cuota Mensual Total')
      }
      if (!tenantInfo.employer || tenantInfo.employer.trim() === '') {
        missingFields.push('Empleador')
      }
      if (!tenantInfo.credit_score || tenantInfo.credit_score <= 0) {
        missingFields.push('Score Crediticio')
      }
      if (!tenantInfo.score_date) {
        missingFields.push('Fecha del Score')
      }
      
      // Pestaña Imágenes
      if (images.length === 0) {
        missingFields.push('Al menos una imagen')
      }
      
      setValidationErrors(missingFields)
      return missingFields.length === 0
    } catch (error) {
      console.error("Error validating:", error)
      return false
    } finally {
      setValidating(false)
    }
  }

  const saveData = async () => {
    setLoading(true)
    try {
      // Guardar datos de valuación
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/valuation/${valuationId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valuationData)
        }
      )

      // Guardar información del inquilino
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/tenant-info/${valuationId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...tenantInfo,
            score_date: new Date(tenantInfo.score_date).toISOString()
          })
        }
      )

      // Subir imágenes nuevas (solo las que aún no se han subido)
      const newImages = images.filter(img => img.file && !img.uploaded)
      if (newImages.length > 0) {
        const formData = new FormData()
        newImages.forEach((img) => {
          if (img.file) {
            formData.append('images', img.file)
            formData.append(`captions`, img.caption)
          }
        })
        
        const uploadResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/images/${valuationId}`,
          {
            method: 'POST',
            body: formData
          }
        )
        
        if (uploadResponse.ok) {
          // Marcar las imágenes como subidas
          setImages(prevImages => 
            prevImages.map(img => 
              img.file ? { ...img, uploaded: true } : img
            )
          )
        }
      }
      
      // Subir imagen de fachada si es nueva
      if (facadeImage?.file && !facadeImage.uploaded) {
        const facadeFormData = new FormData()
        facadeFormData.append('images', facadeImage.file)
        facadeFormData.append('captions', 'Fachada')  // El backend espera una lista pero FormData lo maneja
        facadeFormData.append('is_facade', 'true') // Indicador especial para la imagen de fachada
        
        const facadeUploadResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/images/${valuationId}`,
          {
            method: 'POST',
            body: facadeFormData
          }
        )
        
        if (!facadeUploadResponse.ok) {
          const errorData = await facadeUploadResponse.json()
          console.error('Error uploading facade image:', errorData)
          showToast("Error al subir la imagen de fachada", "error")
        } else {
          // Marcar la imagen de fachada como subida
          setFacadeImage(prev => prev ? { ...prev, uploaded: true } : null)
        }
      }

      showToast("La información se guardó correctamente", "success")

      return true
    } catch (error) {
      console.error("Error saving data:", error)
      showToast("No se pudo guardar la información", "error")
      return false
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos financieros del Excel (solo lectura, no se guardan)
  const loadFinancialDataFromExcel = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-form/financial-data-fast/${valuationId}`
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setValuationData(prev => ({
            ...prev,
            purchase_price: data.data.precio_compra || 0,
            closing_costs: data.data.gastos_cierre || 0,
            user_down_payment: data.data.cuota_inicial_usuario || 0,
            total_investment: data.data.total_investment || 0,
            administration_fee: data.data.cuota_administracion || 0,
            floor: data.data.piso || 0
          }))
        }
      }
    } catch (error) {
      console.warn("No se pudieron cargar datos financieros del dashboard:", error)
    }
  }

  const handleGeneratePresentation = async () => {
    // Validar que haya imagen de fachada
    if (!facadeImage) {
      showToast("La imagen de fachada es obligatoria para generar el PDF", "error")
      // Cambiar a la pestaña de imágenes para que el usuario vea el problema
      setActiveTab("images")
      return
    }
    
    // Luego validar el resto del formulario
    const isValid = await validateForm()
    if (!isValid) {
      showToast("Por favor completa todos los campos requeridos", "error")
      return
    }

    // Guardar datos
    const saved = await saveData()
    if (saved) {
      // Generar presentación
      setGeneratingPresentation(true)
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-presentation/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              valuation_id: valuationId
            })
          }
        )
        
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.presentation_url) {
            // Abrir la presentación en una nueva pestaña
            window.open(result.presentation_url, '_blank')
            showToast("Presentación generada exitosamente", "success")
            onComplete()
          } else {
            showToast(result.message || "Error al generar la presentación", "error")
          }
        } else {
          showToast("Error al generar la presentación", "error")
        }
      } catch (error) {
        console.error("Error generating presentation:", error)
        showToast("Error al generar la presentación", "error")
      } finally {
        setGeneratingPresentation(false)
      }
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={generatingPresentation ? undefined : onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Presentación para Inversionistas</DialogTitle>
          <DialogDescription>
            Complete la información adicional para generar la presentación de propuesta de inversión
          </DialogDescription>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Campos faltantes: {validationErrors.join(", ")}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className={`w-full ${generatingPresentation ? 'pointer-events-none' : ''}`}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="description">
              <Home className="h-4 w-4 mr-2" />
              Descripción
            </TabsTrigger>
            <TabsTrigger value="financial">
              <DollarSign className="h-4 w-4 mr-2" />
              Financiero
            </TabsTrigger>
            <TabsTrigger value="tenant">
              <User className="h-4 w-4 mr-2" />
              Inquilino
            </TabsTrigger>
            <TabsTrigger value="images">
              <Image className="h-4 w-4 mr-2" />
              Imágenes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Descripción del Inmueble</CardTitle>
                <CardDescription>Información detallada sobre la propiedad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="administration_fee">Cuota de Administración</Label>
                    <Input
                      id="administration_fee"
                      type="text"
                      value={formatNumber(valuationData.administration_fee || '')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setValuationData(prev => ({ ...prev, administration_fee: value ? Number(value) : undefined }))
                      }}
                      placeholder="Ej: 450.000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="floor">Piso</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={valuationData.floor || ''}
                      onChange={(e) => setValuationData(prev => ({ ...prev, floor: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Ej: 4"
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">
                    Descripción detallada
                    <span className="text-sm text-muted-foreground ml-2">
                      ({valuationData.description.length}/680 caracteres)
                    </span>
                  </Label>
                  <Textarea
                    id="description"
                    value={valuationData.description}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.length <= 680) {
                        setValuationData(prev => ({ ...prev, description: value }))
                      }
                    }}
                    placeholder="Describa las características principales del inmueble, ubicación, acabados, etc."
                    rows={14}
                    maxLength={680}
                    className={valuationData.description.length > 540 ? 'border-yellow-500' : ''}
                  />
                  {valuationData.description.length > 540 && (
                    <p className="text-sm text-yellow-600 mt-1">
                      Acercándose al límite de caracteres (recomendado: máximo 680)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Información Financiera</CardTitle>
                <CardDescription>Datos económicos de la inversión</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_price">Precio de Compra</Label>
                    <Input
                      id="purchase_price"
                      type="text"
                      value={formatNumber(valuationData.purchase_price || 0)}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="closing_costs">Gastos de Cierre</Label>
                    <Input
                      id="closing_costs"
                      type="text"
                      value={formatNumber(valuationData.closing_costs || 0)}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="user_down_payment">Cuota Inicial Usuario</Label>
                    <Input
                      id="user_down_payment"
                      type="text"
                      value={formatNumber(valuationData.user_down_payment || 0)}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold">Inversión Total</Label>
                    <div className="text-2xl font-bold text-green-600 mt-1">
                      ${formatNumber(valuationData.total_investment || 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenant" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Información del Inquilino</CardTitle>
                <CardDescription>Datos financieros y crediticios del arrendatario</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthly_income">Ingresos Mensuales Certificados</Label>
                    <Input
                      id="monthly_income"
                      type="text"
                      value={formatNumber(tenantInfo.monthly_income)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setTenantInfo(prev => ({ ...prev, monthly_income: Number(value) }))
                      }}
                      onBlur={calculateRatios}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthly_payment">Cuota Mensual Total</Label>
                    <Input
                      id="monthly_payment"
                      type="text"
                      value={formatNumber(tenantInfo.monthly_payment)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setTenantInfo(prev => ({ ...prev, monthly_payment: Number(value) }))
                      }}
                      onBlur={calculateRatios}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="employer">Empleador</Label>
                    <Input
                      id="employer"
                      value={tenantInfo.employer}
                      onChange={(e) => setTenantInfo(prev => ({ ...prev, employer: e.target.value }))}
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <Label htmlFor="credit_score">Score Crediticio Promedio</Label>
                    <Input
                      id="credit_score"
                      type="number"
                      value={tenantInfo.credit_score}
                      onChange={(e) => setTenantInfo(prev => ({ ...prev, credit_score: Number(e.target.value) }))}
                      placeholder="300-850"
                    />
                  </div>
                  <div>
                    <Label htmlFor="score_date">Fecha del Score</Label>
                    <Input
                      id="score_date"
                      type="date"
                      value={tenantInfo.score_date}
                      onChange={(e) => setTenantInfo(prev => ({ ...prev, score_date: e.target.value }))}
                    />
                  </div>
                </div>
                {tenantInfo.monthly_income > 0 && tenantInfo.monthly_payment > 0 && (
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Cobertura Ingresos/Cuota</Label>
                        <p className="text-lg font-semibold">
                          {(tenantInfo.monthly_income / tenantInfo.monthly_payment).toFixed(2)}x
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Cuota/Ingresos</Label>
                        <p className="text-lg font-semibold">
                          {((tenantInfo.monthly_payment / tenantInfo.monthly_income) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
            {/* Imagen de Fachada - OBLIGATORIA - Se muestra primero */}
            <Card className={!facadeImage ? "border-orange-500" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Imagen de Fachada
                  <Badge variant={facadeImage ? "default" : "destructive"}>
                    {facadeImage ? "✓ Cargada" : "Obligatoria para PDF"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Esta imagen es <span className="font-semibold">obligatoria</span> para generar el PDF. Se mostrará como la imagen principal del inmueble
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!facadeImage ? (
                  <div className="border-2 border-dashed border-orange-500 rounded-lg p-6 text-center hover:border-orange-600 transition-colors bg-orange-50">
                    <Input
                      id="facade-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFacadeImageUpload}
                      className="hidden"
                    />
                    <Label
                      htmlFor="facade-image-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-12 w-12 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Subir imagen de fachada (Obligatoria)
                      </span>
                      <span className="text-xs text-gray-500">
                        PNG, JPG hasta 5MB
                      </span>
                    </Label>
                  </div>
                ) : (
                  <div className="relative border rounded-lg p-2">
                    {(facadeImage.preview || facadeImage.image_path) && (
                      <img
                        src={facadeImage.preview || facadeImage.image_path || ''}
                        alt="Imagen de Fachada"
                        className="w-full h-48 object-cover rounded"
                        onError={(e) => {
                          // Si la imagen falla al cargar, mostrar placeholder
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EFachada%3C/text%3E%3C/svg%3E'
                        }}
                      />
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Fachada</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFacadeImage}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Imágenes adicionales del inmueble */}
            <Card>
              <CardHeader>
                <CardTitle>Imágenes del Inmueble</CardTitle>
                <CardDescription>
                  <span className={images.length >= 6 ? "text-orange-600 font-semibold" : ""}>
                    {images.length} de 6 imágenes
                  </span>
                  {images.length >= 6 && (
                    <span className="text-orange-600 ml-2">• Límite alcanzado</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label 
                    htmlFor="image-upload" 
                    className={images.length >= 6 ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                  >
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      images.length >= 6 
                        ? "border-gray-200 bg-gray-50" 
                        : "border-gray-300 hover:border-gray-400"
                    }`}>
                      <Upload className={`mx-auto h-12 w-12 ${
                        images.length >= 6 ? "text-gray-300" : "text-gray-400"
                      }`} />
                      <p className={`mt-2 text-sm ${
                        images.length >= 6 ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {images.length >= 6 
                          ? "Límite de imágenes alcanzado" 
                          : "Click para seleccionar imágenes o arrastra aquí"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {images.length >= 6 
                          ? "Elimina una imagen para agregar otra" 
                          : `PNG, JPG hasta 5MB cada una • Puedes agregar ${6 - images.length} más`}
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={images.length >= 6}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative border rounded-lg p-2">
                      {(image.preview || image.image_path) && (
                        <img
                          src={image.preview || image.image_path || ''}
                          alt={`Imagen ${index + 1}`}
                          className="w-full h-32 object-cover rounded"
                          onError={(e) => {
                            // Si la imagen falla al cargar (por ejemplo, URL expirada), mostrar placeholder
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImagen%3C/text%3E%3C/svg%3E'
                          }}
                        />
                      )}
                      <Input
                        type="text"
                        value={image.caption}
                        onChange={(e) => {
                          const newImages = [...images]
                          newImages[index].caption = e.target.value
                          setImages(newImages)
                        }}
                        placeholder="Descripción de la imagen"
                        className="mt-2"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className={generatingPresentation ? 'pointer-events-none' : ''}>
          <Button variant="outline" onClick={onClose} disabled={generatingPresentation}>
            Cancelar
          </Button>
          <Button onClick={saveData} disabled={loading || generatingPresentation}>
            Guardar Cambios
          </Button>
          <Button onClick={handleGeneratePresentation} disabled={loading || validating || generatingPresentation}>
            {generatingPresentation ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generar Presentación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Overlay de carga durante generación - Fuera del Dialog para cubrir toda la pantalla */}
    {generatingPresentation && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[9999]" style={{ overflow: 'hidden' }}>
        <div className="bg-background rounded-lg p-8 shadow-2xl border flex flex-col items-center max-w-md mx-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-xl font-semibold text-center">Generando presentación...</p>
          <p className="text-sm text-muted-foreground mt-3 text-center">Esto puede tomar unos segundos, por favor no cierre esta ventana</p>
        </div>
      </div>
    )}
  </>
  )
}