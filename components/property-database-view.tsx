"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronLeft, ChevronRight, Filter, ExternalLink, MapPin } from "lucide-react"
import { fetchProperties, fetchCitiesList, type Property, type PropertiesResponse, type CityOption } from "@/lib/api"

export function PropertyDatabaseView() {
  const [data, setData] = useState<PropertiesResponse | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
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
    rooms: 'any'
  })
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)

  const loadProperties = async (page: number = 1, newFilters = filters) => {
    try {
      setLoading(true)
      setError(null)
      
      // Convertir strings vacíos a undefined y parsear números
      const cleanFilters = {
        city_id: newFilters.city_id === 'all' ? undefined : parseInt(newFilters.city_id),
        offer_type: newFilters.offer_type === 'all' ? undefined : newFilters.offer_type,
        min_price: newFilters.min_price ? parseFloat(newFilters.min_price) : undefined,
        max_price: newFilters.max_price ? parseFloat(newFilters.max_price) : undefined,
        min_area: newFilters.min_area ? parseFloat(newFilters.min_area) : undefined,
        max_area: newFilters.max_area ? parseFloat(newFilters.max_area) : undefined,
        rooms: newFilters.rooms === 'any' ? undefined : parseInt(newFilters.rooms)
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
        
        // Cargar propiedades
        loadProperties(1)
      } catch (error) {
        console.error('Error loading initial data:', error)
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
      rooms: 'any'
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
            <label className="text-sm font-medium">Habitaciones</label>
            <Select value={filters.rooms} onValueChange={(value) => handleFilterChange('rooms', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5+</SelectItem>
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
          
          <div className="flex items-end gap-2">
            <Button onClick={handleSearch} className="flex-1">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <Filter className="h-4 w-4" />
            </Button>
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
                <TableHead>Precio</TableHead>
                <TableHead>FincaRaiz</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Fecha Creación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Cargando propiedades...
                  </TableCell>
                </TableRow>
              ) : data?.properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No se encontraron propiedades con los filtros aplicados
                  </TableCell>
                </TableRow>
              ) : (
                data?.properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-mono text-sm">{property.id}</TableCell>
                    <TableCell>{property.city}</TableCell>
                    <TableCell>
                      <Badge variant={property.offer_type === 'Venta' ? 'default' : 'secondary'}>
                        {property.offer_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{property.area?.toLocaleString() || 'N/A'}</TableCell>
                    <TableCell>{property.rooms || 'N/A'}</TableCell>
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
