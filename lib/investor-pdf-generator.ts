interface InvestorPDFData {
  valuation: any
  tenant_info: any
  images: any[]
}

export async function generateInvestorPDF(valuationId: number, valuationName: string, googleMapsApiKey?: string) {
  try {
    console.log('🔄 Generating PDF using backend service...')
    
    // Llamar al nuevo endpoint del backend que genera el PDF completo
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/investor-pdf/generate/${valuationId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Error generating PDF: ${errorText}`)
    }
    
    // Obtener el PDF como blob
    const pdfBlob = await response.blob()
    
    // Crear URL para descarga
    const url = window.URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte_inversion_${valuationName}_${new Date().getTime()}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    console.log('✅ PDF generated and downloaded successfully')
    return true
    
  } catch (error) {
    console.error('❌ Error generando PDF:', error)
    throw error
  }
}