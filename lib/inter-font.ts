// Inter font for jsPDF - Base64 encoded
// Warning: This adds ~556KB to the bundle

export const addInterFont = async (pdf: any) => {
  try {
    const response = await fetch('/fonts/Inter-Regular.ttf')
    if (!response.ok) {
      throw new Error('Font file not found')
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Convert to base64
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('')
    const base64String = btoa(binaryString)
    
    // Add font to PDF
    pdf.addFileToVFS('Inter-Regular.ttf', base64String)
    pdf.addFont('Inter-Regular.ttf', 'Inter', 'normal')
    pdf.setFont('Inter', 'normal')
    console.log('Inter font loaded successfully')
    
  } catch (error) {
    console.warn('Inter font could not be loaded, using Arial fallback:', error)
    try {
      pdf.setFont('Arial', 'normal')
    } catch {
      pdf.setFont('helvetica', 'normal')
    }
  }
}