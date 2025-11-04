// Utilidades para exportar datos a Excel/CSV sin dependencias externas

import type { Property } from "@/lib/api"

export interface ExportOptions {
  filename?: string
  includeHeaders?: boolean
  format?: 'csv' | 'excel'
}

// Función para convertir propiedades a formato CSV optimizado para Excel
export function propertiesToCSV(properties: Property[], options: ExportOptions = {}): string {
  const { includeHeaders = true } = options
  
  // Definir las columnas y sus headers con separador especial para Excel
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'title', header: 'Título' },
    { key: 'city', header: 'Ciudad' },
    { key: 'offer_type', header: 'Tipo' },
    { key: 'price', header: 'Precio (COP)' },
    { key: 'area', header: 'Área (m²)' },
    { key: 'rooms', header: 'Habitaciones' },
    { key: 'baths', header: 'Baños' },
    { key: 'garages', header: 'Garajes' },
    { key: 'stratum', header: 'Estrato' },
    { key: 'antiquity', header: 'Antigüedad' },
    { key: 'creation_date', header: 'Fecha Creación' },
    { key: 'last_update', header: 'Última Actualización' },
    { key: 'finca_raiz_link', header: 'Enlace FincaRaiz' },
    { key: 'maps_link', header: 'Enlace Maps' }
  ]

  // Usar punto y coma como separador para mejor compatibilidad con Excel en español
  const separator = ';'
  let csvContent = ''
  
  // Agregar headers si se requiere
  if (includeHeaders) {
    csvContent += columns.map(col => formatCellValue(col.header)).join(separator) + '\n'
  }
  
  // Agregar datos
  properties.forEach(property => {
    const row = columns.map(col => {
      let value = property[col.key as keyof Property]
      
      // Formatear valores especiales para mejor legibilidad en Excel
      if (col.key === 'price' && value) {
        // Formatear precio sin separadores de miles para Excel
        const numericPrice = Number(value)
        if (numericPrice > 0) {
          value = numericPrice.toString()
        } else {
          value = ''
        }
      } else if (col.key === 'offer_type') {
        value = value === 'sell' ? 'Venta' : value === 'rent' ? 'Arriendo' : (value || '')
      } else if (col.key === 'creation_date' || col.key === 'last_update') {
        if (value) {
          const date = new Date(value as string)
          // Formato fecha ISO para Excel: YYYY-MM-DD
          if (!isNaN(date.getTime())) {
            value = date.toISOString().split('T')[0]
          } else {
            value = ''
          }
        } else {
          value = ''
        }
      } else if (col.key === 'area' && value) {
        // Asegurar que el área sea numérica
        const numericArea = Number(value)
        value = numericArea > 0 ? numericArea.toString() : ''
      } else if (col.key === 'rooms' || col.key === 'baths' || col.key === 'garages' || col.key === 'stratum') {
        // Formatear números enteros
        const numericValue = Number(value)
        value = numericValue > 0 ? numericValue.toString() : ''
      } else if (col.key === 'finca_raiz_link') {
        // Crear hipervínculo para FincaRaiz usando función HYPERLINK
        if (value && value.toString().trim()) {
          const url = value.toString().trim()
          value = `=HYPERLINK("${url}";"Ver en FincaRaiz")`
        } else {
          value = ''
        }
      } else if (col.key === 'maps_link') {
        // Crear hipervínculo para Maps usando coordenadas
        const latitude = property.latitude
        const longitude = property.longitude
        if (latitude && longitude) {
          const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
          value = `=HYPERLINK("${mapsUrl}";"Ver en Maps")`
        } else {
          value = ''
        }
      } else if (value === null || value === undefined) {
        value = ''
      }
      
      return formatCellValue(String(value))
    })
    
    csvContent += row.join(separator) + '\n'
  })
  
  return csvContent
}

// Función auxiliar para formatear celdas correctamente para Excel
function formatCellValue(value: string): string {
  if (!value) return '""'
  
  // Limpiar el valor
  const cleanValue = value.toString().trim()
  
  // Si es una fórmula de Excel (como HYPERLINK), envolver en comillas para escapar los ; internos
  if (cleanValue.startsWith('=')) {
    return `"${cleanValue.replace(/"/g, '""')}"`
  }
  
  // Si contiene separadores especiales, envolver en comillas y escapar comillas internas
  if (cleanValue.includes(';') || cleanValue.includes('"') || cleanValue.includes('\n') || cleanValue.includes('\r')) {
    return `"${cleanValue.replace(/"/g, '""')}"`
  }
  
  // Para valores numéricos grandes, asegurar que no se interpreten como fechas
  if (/^\d{8,}$/.test(cleanValue)) {
    return `"${cleanValue}"`
  }
  
  return `"${cleanValue}"`
}

// Función para generar y descargar el archivo Excel (CSV)
export function downloadPropertiesAsExcel(properties: Property[], options: ExportOptions = {}) {
  const { filename = 'propiedades' } = options
  
  if (properties.length === 0) {
    return { success: false, error: 'No hay datos para exportar' }
  }
  
  try {
    const csvContent = propertiesToCSV(properties, options)
    
    // Crear el archivo con BOM para soporte de UTF-8 en Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    })
    
    // Crear link de descarga
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    // Generar nombre del archivo con timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    link.setAttribute('download', `${filename}_${timestamp}.csv`)
    
    // Trigger download
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Limpiar URL
    URL.revokeObjectURL(url)
    
    return { success: true }
  } catch (error) {
    console.error('Error al generar archivo Excel:', error)
    return { success: false, error: 'Error al generar el archivo. Por favor, inténtalo de nuevo.' }
  }
}

// Función para generar estadísticas de exportación
export function generateExportSummary(properties: Property[]): string {
  const summary = {
    total: properties.length,
    byOfferType: properties.reduce((acc, prop) => {
      const type = prop.offer_type === 'sell' ? 'Venta' : 'Arriendo'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byCities: properties.reduce((acc, prop) => {
      acc[prop.city] = (acc[prop.city] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    priceRange: {
      min: Math.min(...properties.map(p => p.price || 0)),
      max: Math.max(...properties.map(p => p.price || 0)),
      avg: properties.reduce((sum, p) => sum + (p.price || 0), 0) / properties.length
    }
  }
  
  return `
Resumen de Exportación:
- Total de propiedades: ${summary.total}
- Por tipo: ${Object.entries(summary.byOfferType).map(([type, count]) => `${type}: ${count}`).join(', ')}
- Rango de precios: $${summary.priceRange.min.toLocaleString()} - $${summary.priceRange.max.toLocaleString()}
- Precio promedio: $${Math.round(summary.priceRange.avg).toLocaleString()}
  `.trim()
}