"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronLeft, ChevronRight, ExternalLink, MapPin, Download, RotateCcw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchProperties, fetchCitiesList, type Property, type PropertiesResponse, type CityOption } from "@/lib/api"
import { downloadPropertiesAsExcel } from "@/lib/excel-export"
import { useAlert } from "@/hooks/use-alert"
import { useConfirm } from "@/hooks/use-confirm"

export function PropertyDatabaseView() {
  const [data, setData] = useState<PropertiesResponse | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
  const { success: showSuccess, error: showError } = useAlert()
  const { confirm } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros
  const [filters, setFilters] = useState({
    city_id: 'all',
    offer_type: 'all',
    min_price: '',
    max_price: '',
    min_area: '',
    max_area: '',
    rooms: 'any',
    baths: 'any',
    garages: 'any',
    stratum: 'any',
    antiquity: 'any',
    property_type: 'any',
    updated_date_from: '',
    updated_date_to: ''
  })
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)

  const loadProperties = async (page: number = 1, newFilters = filters) => {
    try {
      setLoading(true)
      setError(null)
      
      // Convertir strings vacíos a undefined y parsear números
      let min_antiquity = undefined;
      let max_antiquity = undefined;
      
      // Procesar rangos de antigüedad
      let antiquity_filter = undefined;
      if (newFilters.antiquity !== 'any') {
        switch(newFilters.antiquity) {
          case '0-1': min_antiquity = 0; max_antiquity = 0; break;
          case '1-8': min_antiquity = 1; max_antiquity = 8; break;
          case '9-15': min_antiquity = 9; max_antiquity = 15; break;
          case '16-30': min_antiquity = 16; max_antiquity = 30; break;
          case '30+': min_antiquity = 31; max_antiquity = 999; break;
          case 'unspecified': antiquity_filter = 'unspecified'; break;
        }
      }
      
      const cleanFilters = {
        city_id: newFilters.city_id === 'all' ? undefined : parseInt(newFilters.city_id),
        offer_type: newFilters.offer_type === 'all' ? undefined : newFilters.offer_type,
        min_price: newFilters.min_price ? parseFloat(newFilters.min_price) : undefined,
        max_price: newFilters.max_price ? parseFloat(newFilters.max_price) : undefined,
        min_area: newFilters.min_area ? parseFloat(newFilters.min_area) : undefined,
        max_area: newFilters.max_area ? parseFloat(newFilters.max_area) : undefined,
        rooms: newFilters.rooms === 'any' ? undefined : newFilters.rooms,
        baths: newFilters.baths === 'any' ? undefined : newFilters.baths,
        garages: newFilters.garages === 'any' ? undefined : newFilters.garages,
        stratum: newFilters.stratum === 'any' ? undefined : (newFilters.stratum === 'unspecified' ? 'unspecified' : parseInt(newFilters.stratum)),
        min_antiquity: min_antiquity,
        max_antiquity: max_antiquity,
        antiquity_filter: antiquity_filter,
        property_type: newFilters.property_type === 'any' ? undefined : newFilters.property_type,
        updated_date_from: newFilters.updated_date_from || undefined,
        updated_date_to: newFilters.updated_date_to || undefined
      }
      
      // Debug: log para ver qué filtros se están enviando
      console.log('Sending filters to API:', cleanFilters)
      console.log('ROOMS VALUE BEING SENT:', cleanFilters.rooms)
      
      const result = await fetchProperties(page, pageSize, cleanFilters)
      setData(result)
      
      // Debug: log para ver la respuesta
      console.log('API response:', result)
      console.log('Properties data:', result.properties.map(p => ({id: p.id, rooms: p.rooms})))
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
          city_id: 'all',
          offer_type: 'all',
          min_price: '',
          max_price: '',
          min_area: '',
          max_area: '',
          rooms: 'any',
          baths: 'any',
          garages: 'any',
          stratum: 'any',
          antiquity: 'any',
          property_type: 'any',
          updated_date_from: '',
          updated_date_to: ''
        }
        loadProperties(1, emptyFilters)
      } catch (error) {
        console.error('Error loading initial data:', error)
        setError('Error al cargar datos iniciales')
      }
    }
    
    loadInitialData()
  }, [])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadProperties(1, filters)
  }

  const handleClearFilters = () => {
    const emptyFilters = {
      city_id: 'all',
      offer_type: 'all',
      min_price: '',
      max_price: '',
      min_area: '',
      max_area: '',
      rooms: 'any',
      baths: 'any',
      garages: 'any',
      stratum: 'any',
      antiquity: 'any',
      property_type: 'any',
      updated_date_from: '',
      updated_date_to: ''
    }
    setFilters(emptyFilters)
    setCurrentPage(1)
    loadProperties(1, emptyFilters)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    loadProperties(newPage, filters)
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
    const confirmed = await confirm(`¿Deseas descargar TODAS las ${totalCount.toLocaleString()} propiedades disponibles?\n\nEsto incluirá todas las páginas de resultados.`)
    
    if (!confirmed) return

    try {
      // Mostrar loading
      const exportBtn = document.querySelector('[data-export-btn]') as HTMLButtonElement
      if (exportBtn) {
        exportBtn.disabled = true
        exportBtn.textContent = 'Descargando...'
      }

      // Obtener todas las propiedades página por página
      const allProperties: Property[] = []
      const totalPages = data.pagination.total_pages
      
      console.log(`Iniciando descarga de ${totalPages} páginas...`)
      console.log('Filtros actuales:', filters)
      
      for (let page = 1; page <= totalPages; page++) {
        // Usar exactamente la misma lógica de conversión que loadProperties
        let min_antiquity = undefined;
        let max_antiquity = undefined;
        let antiquity_filter = undefined;
        
        if (filters.antiquity !== 'any') {
          switch(filters.antiquity) {
            case '0-1': min_antiquity = 0; max_antiquity = 0; break;
            case '1-8': min_antiquity = 1; max_antiquity = 8; break;
            case '9-15': min_antiquity = 9; max_antiquity = 15; break;
            case '16-30': min_antiquity = 16; max_antiquity = 30; break;
            case '30+': min_antiquity = 31; max_antiquity = 999; break;
            case 'unspecified': antiquity_filter = 'unspecified'; break;
          }
        }
        
        const cleanFilters = {
          city_id: filters.city_id === 'all' ? undefined : parseInt(filters.city_id),
          offer_type: filters.offer_type === 'all' ? undefined : filters.offer_type,
          min_price: filters.min_price ? parseFloat(filters.min_price) : undefined,
          max_price: filters.max_price ? parseFloat(filters.max_price) : undefined,
          min_area: filters.min_area ? parseFloat(filters.min_area) : undefined,
          max_area: filters.max_area ? parseFloat(filters.max_area) : undefined,
          rooms: filters.rooms === 'any' ? undefined : filters.rooms,
          baths: filters.baths === 'any' ? undefined : filters.baths,
          garages: filters.garages === 'any' ? undefined : filters.garages,
          stratum: filters.stratum === 'any' ? undefined : (filters.stratum === 'unspecified' ? 'unspecified' : parseInt(filters.stratum)),
          min_antiquity: min_antiquity,
          max_antiquity: max_antiquity,
          antiquity_filter: antiquity_filter,
          property_type: filters.property_type === 'any' ? undefined : filters.property_type,
          updated_date_from: filters.updated_date_from || undefined,
          updated_date_to: filters.updated_date_to || undefined
        }
        
        console.log(`Página ${page} - Filtros enviados:`, cleanFilters)
        const response = await fetchProperties(page, 100, cleanFilters) // 100 items per page for faster download
        console.log(`Página ${page}: ${response.properties.length} propiedades`)
        console.log(`Página ${page} - Respuesta completa:`, response)
        allProperties.push(...response.properties)
        
        // Actualizar progreso
        if (exportBtn) {
          exportBtn.textContent = `Descargando... (${Math.round((page / totalPages) * 100)}%)`
        }
      }

      console.log(`Total descargado: ${allProperties.length} propiedades`)
      
      // Verificar que tenemos datos antes de continuar
      if (allProperties.length === 0) {
        showError('No se encontraron propiedades para exportar con los filtros actuales.')
        return
      }

      // Generar y descargar el archivo
      const result = downloadPropertiesAsExcel(allProperties, {
        filename: 'propiedades_completa'
      })
      
      if (result.success) {
        showSuccess(`¡Archivo descargado exitosamente!\n\nSe descargaron ${allProperties.length.toLocaleString()} propiedades.`)
      } else {
        showError(result.error || 'Error al generar el archivo')
      }

    } catch (error) {
      console.error('Error al exportar:', error)
      showError('Error al descargar el archivo. Por favor, inténtalo de nuevo.')
    } finally {
      // Restaurar botón
      const exportBtn = document.querySelector('[data-export-btn]') as HTMLButtonElement
      if (exportBtn) {
        exportBtn.disabled = false
        exportBtn.textContent = 'Descargar Excel'
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de Datos de Propiedades</CardTitle>
        <p className="text-sm text-muted-foreground">
          Explora y filtra el inventario completo de propiedades
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ciudad</label>
            <Select value={filters.city_id} onValueChange={(value) => handleFilterChange('city_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ciudad..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ciudades</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id.toString()}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Precio Mínimo</label>
            <Input
              type="number"
              placeholder="0"
              value={filters.min_price}
              onChange={(e) => handleFilterChange('min_price', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Precio Máximo</label>
            <Input
              type="number"
              placeholder="Sin límite"
              value={filters.max_price}
              onChange={(e) => handleFilterChange('max_price', e.target.value)}
            />
          </div>

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
            <Select value={filters.rooms} onValueChange={(value) => handleFilterChange('rooms', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="unspecified">Sin especificar</SelectItem>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5+">5+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Baños</label>
            <Select value={filters.baths} onValueChange={(value) => handleFilterChange('baths', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="unspecified">Sin especificar</SelectItem>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4+">4+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Garajes</label>
            <Select value={filters.garages} onValueChange={(value) => handleFilterChange('garages', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="unspecified">Sin especificar</SelectItem>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3+">3+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estrato</label>
            <Select value={filters.stratum} onValueChange={(value) => handleFilterChange('stratum', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="unspecified">Sin especificar</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Antigüedad</label>
            <Select value={filters.antiquity} onValueChange={(value) => handleFilterChange('antiquity', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="0-1">Menos de 1 año</SelectItem>
                <SelectItem value="1-8">1 a 8 años</SelectItem>
                <SelectItem value="9-15">9 a 15 años</SelectItem>
                <SelectItem value="16-30">16 a 30 años</SelectItem>
                <SelectItem value="30+">Más de 30 años</SelectItem>
                <SelectItem value="unspecified">Sin especificar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Inmueble</label>
            <Select value={filters.property_type} onValueChange={(value) => handleFilterChange('property_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="oficina">Oficina</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="bodega">Bodega</SelectItem>
              </SelectContent>
            </Select>
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
              onChange={(e) => handleFilterChange('updated_date_to', e.target.value)}
            />
          </div>

          {/* Botones de acción */}
          <div className="lg:col-span-full">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSearch} className="w-full sm:w-auto sm:min-w-[120px]">
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Aplicar filtros y buscar propiedades</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto sm:min-w-[120px] flex items-center justify-center gap-2">
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
                    className="w-full sm:w-auto sm:min-w-[140px] flex items-center justify-center gap-2"
                    data-export-btn
                  >
                    <Download className="h-4 w-4" />
                    Descargar Excel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Descargar todas las propiedades de la consulta actual como archivo Excel</p>
                  {data && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total: {data.pagination.total_count.toLocaleString()} propiedades
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Tabla de propiedades */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Área (m²)</TableHead>
                <TableHead>Habitaciones</TableHead>
                <TableHead>Baños</TableHead>
                <TableHead>Garajes</TableHead>
                <TableHead>Estrato</TableHead>
                <TableHead>Antigüedad</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>FincaRaiz</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Fecha Actualización</TableHead>
                <TableHead>Fecha Creación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8">
                    Cargando propiedades...
                  </TableCell>
                </TableRow>
              ) : data?.properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
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
  )
}
