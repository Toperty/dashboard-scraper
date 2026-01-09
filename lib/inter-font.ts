// Inter font for jsPDF - Loads Regular and Bold variants
// Warning: This adds ~800KB to the bundle (both fonts)

export const addInterFont = async (pdf: any) => {
  try {
    // Load Inter Regular
    const regularResponse = await fetch('/fonts/Inter-Regular.ttf')
    if (!regularResponse.ok) {
      throw new Error('Inter-Regular.ttf not found')
    }
    
    const regularBuffer = await regularResponse.arrayBuffer()
    const regularUint8 = new Uint8Array(regularBuffer)
    const regularBinary = Array.from(regularUint8, byte => String.fromCharCode(byte)).join('')
    const regularBase64 = btoa(regularBinary)
    
    // Add Regular font to PDF
    pdf.addFileToVFS('Inter-Regular.ttf', regularBase64)
    pdf.addFont('Inter-Regular.ttf', 'Inter', 'normal')
    
    // Load Inter Bold
    const boldResponse = await fetch('/fonts/Inter-Bold.ttf')
    if (!boldResponse.ok) {
      console.warn('Inter-Bold.ttf not found, using Regular for bold')
      pdf.addFont('Inter-Regular.ttf', 'Inter', 'bold')
    } else {
      const boldBuffer = await boldResponse.arrayBuffer()
      const boldUint8 = new Uint8Array(boldBuffer)
      const boldBinary = Array.from(boldUint8, byte => String.fromCharCode(byte)).join('')
      const boldBase64 = btoa(boldBinary)
      
      // Add Bold font to PDF
      pdf.addFileToVFS('Inter-Bold.ttf', boldBase64)
      pdf.addFont('Inter-Bold.ttf', 'Inter', 'bold')
    }
    
    pdf.setFont('Inter', 'normal')
    console.log('Inter fonts loaded successfully (Regular + Bold)')
    
    return true
  } catch (error) {
    console.warn('Inter font could not be loaded, using Helvetica fallback:', error)
    try {
      pdf.setFont('helvetica', 'normal')
    } catch {
      // Helvetica is always available as default
    }
    return false
  }
}

// Helper to set Inter font with style
export const setInterFont = (pdf: any, style: 'normal' | 'bold' = 'normal') => {
  try {
    pdf.setFont('Inter', style)
  } catch {
    pdf.setFont('helvetica', style)
  }
}