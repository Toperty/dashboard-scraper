/**
 * AppScript para generar presentaciones de inversionistas
 * Requiere permisos de Drive, Slides y Sheets
 */

const TEMPLATE_ID = '1XNo0jjmOv6H7dedP3GE4WxM36pbRUbQURZ-kOfEJ6Jc';
const FOLDER_ID = '11CpT9g5tuYnPXwZCPY1G3MJtERcBlmCt';

const SHEET_RANGES = {
  resumen: {
    range: 'B2:E37',
    sheet: 'Resumen',
    placeholder: '{{resumen}}'
  },
  flujo_interno: {
    range: 'B143:J167',
    sheet: 'Flujo Toperty Interno',
    placeholder: '{{simulacion}}'
  }
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'generate_presentation') {
      const result = generatePresentation(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'capture_screenshot') {
      const result = captureScreenshot(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Acción no válida'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function generatePresentation(requestData) {
  const logs = [];
  
  try {
    const data = requestData.data || {};
    const propertyName = data.nombre_inmueble || 'Propiedad';
    const investorEmail = requestData.investor_email;
    const spreadsheetId = data.spreadsheet_id;
    const previousPresentationId = requestData.previous_presentation_id;
    
    // Eliminar presentación anterior si existe
    if (previousPresentationId) {
      try {
        const previousFile = DriveApp.getFileById(previousPresentationId);
        previousFile.setTrashed(true);
        logs.push(`Presentación anterior eliminada: ${previousPresentationId}`);
      } catch (e) {
        logs.push(`No se pudo eliminar presentación anterior: ${e.toString()}`);
      }
    }
    
    // Crear copia de la presentación
    const templateFile = DriveApp.getFileById(TEMPLATE_ID);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const timestamp = Utilities.formatDate(new Date(), "GMT-5", "yyyy-MM-dd_HH-mm");
    const fileName = `Presentación ${propertyName} - ${timestamp}`;
    const newFile = templateFile.makeCopy(fileName, folder);
    const presentation = SlidesApp.openById(newFile.getId());
    
    // Preparar reemplazos con formatos especiales
    const replacements = prepareReplacementsWithFormats(data);
    
    // Reemplazar texto e imágenes
    const replacementResult = replaceInPresentation(presentation, replacements);
    logs.push(...replacementResult);
    
    // Insertar capturas de pantalla del Sheet si existe
    if (spreadsheetId) {
      const imageResult = insertSheetImages(presentation, spreadsheetId);
      logs.push(...imageResult);
    }
    
    // Compartir con el inversionista
    if (investorEmail && investorEmail.includes('@')) {
      try {
        newFile.addViewer(investorEmail);
      } catch (e) {}
    }
    
    return {
      success: true,
      url: presentation.getUrl(),
      fileId: newFile.getId(),
      fileName: fileName,
      logs: logs
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      logs: logs
    };
  }
}

/**
 * Función auxiliar para formatear valores en millones
 */
function formatInMillions(value) {
  if (!value || value === '0') return '0';
  
  // Limpiar el valor de formato
  const cleanValue = String(value).replace(/[^\d]/g, '');
  const numValue = parseFloat(cleanValue);
  
  if (isNaN(numValue)) return '0';
  
  // Convertir a millones
  const millions = numValue / 1000000;
  
  // Formatear con decimales solo si es necesario
  if (millions >= 1000) {
    // Para miles de millones, mostrar con puntos
    return (millions / 1000).toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
  } else if (millions >= 1) {
    // Para millones, mostrar hasta 3 decimales si los tiene
    return millions.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
  } else {
    // Para valores menores a un millón, mostrar con más decimales
    return millions.toFixed(6).replace(/\.?0+$/, '').replace('.', ',');
  }
}

function prepareReplacementsWithFormats(data) {
  const replacements = {};
  
  // Campos básicos sin formato especial
  const basicFields = {
    'nombre_inmueble': data.nombre_inmueble || '',
    'nombre_usuario': data.nombre_usuario || '',
    'descripcion': data.descripcion || '',
    'direccion': data.direccion || '',
    'tipo_propiedad': data.tipo_propiedad || '',
    'area': data.area || '',
    'habitaciones': data.habitaciones || '',
    'banos': data.banos || '',
    'parqueadero': data.parqueadero || '',
    'estrato': data.estrato || '',
    'piso': data.piso || '',
    'antiguedad': data.antiguedad || '',
    'empleador': data.empleador || '',
    'score_promedio': data.score_promedio || '',
    'fecha_score': data.fecha_score || '',
    'email_inversionista': data.email_inversionista || '',
    'fecha': Utilities.formatDate(new Date(), "GMT-5", "dd/MM/yyyy")
  };
  
  // Campos financieros con formato normal
  const financialFields = {
    'valor_inmueble': data.valor_inmueble || '',
    'valor_compra': data.valor_compra || '',
    'cuota_inicial': data.cuota_inicial || '',
    'inversion_total': data.inversion_total || '',
    'administracion': data.administracion || '',
    'cuota_mensual_total': data.cuota_mensual_total || '',
    'gastos_cierre': data.gastos_cierre || '',
    'ingresos_certificados': data.ingresos_certificados || '',
    'canon_arrendamiento': data.canon_arrendamiento || ''
  };
  
  // Campos con formato corto (millones): 1.300.000.000 → 1.300
  const shortFields = {
    'valor_inmueble_corto': data.valor_inmueble_corto || '',
    'inversion_total_corto': data.inversion_total_corto || ''
  };
  
  // Métricas de inversión
  const investmentMetrics = {
    'descuento_compra': data.descuento_compra || '',
    'multiplo_inversion': data.multiplo_inversion || '',
    'tir': data.tir || '',
    'cash_on_cash': data.cash_on_cash || '',
    'ingresos_cuota': data.ingresos_cuota || '',
    'cuota_ingresos': data.cuota_ingresos || ''
  };
  
  // Fotos
  const photos = {
    'foto_1': data.foto_1 || '',
    'foto_2': data.foto_2 || '',
    'foto_3': data.foto_3 || '',
    'foto_4': data.foto_4 || '',
    'foto_5': data.foto_5 || '',
    'foto_6': data.foto_6 || '',
    'mapa': data.mapa || ''  // Mapa estático de Google Maps
  };
  
  // Agregar campos básicos
  Object.keys(basicFields).forEach(key => {
    replacements[`{{${key}}}`] = String(basicFields[key]);
  });
  
  // Agregar campos financieros con formato normal
  Object.keys(financialFields).forEach(key => {
    replacements[`{{${key}}}`] = String(financialFields[key]);
    
    // AGREGAR VERSION EN MILLONES para campos financieros
    replacements[`{{${key}_millones}}`] = formatInMillions(financialFields[key]);
  });
  
  // Agregar campos con formato corto (millones sin decimales)
  Object.keys(shortFields).forEach(key => {
    replacements[`{{${key}}}`] = String(shortFields[key]);
  });
  
  // Agregar métricas
  Object.keys(investmentMetrics).forEach(key => {
    replacements[`{{${key}}}`] = String(investmentMetrics[key]);
  });
  
  // Agregar fotos
  Object.keys(photos).forEach(key => {
    replacements[`{{${key}}}`] = String(photos[key]);
  });
  
  return replacements;
}

function replaceInPresentation(presentation, replacements) {
  const slides = presentation.getSlides();
  const logs = [];
  let totalReplacements = 0;
  let unreplacedPlaceholders = [];
  
  // Separar placeholders de imágenes y texto
  const imageReplacements = {};
  const textReplacements = {};
  
  Object.keys(replacements).forEach(placeholder => {
    // Incluir fotos Y mapa como reemplazos de imagen
    if (placeholder.match(/\{\{(foto_[1-6]|mapa)\}\}/)) {
      imageReplacements[placeholder] = replacements[placeholder];
    } else {
      textReplacements[placeholder] = replacements[placeholder];
    }
  });
  
  // FASE 1: Reemplazar texto con múltiples pasadas mejoradas
  for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
    const slide = slides[slideIndex];
    let slideReplacements = 0;
    
    // Reemplazar en shapes - AUMENTADO A 5 PASADAS
    const shapes = slide.getShapes();
    for (let shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
      try {
        const shape = shapes[shapeIndex];
        const textRange = shape.getText();
        
        if (textRange) {
          // Hacer 5 pasadas para asegurar TODOS los reemplazos
          for (let pass = 1; pass <= 5; pass++) {
            let textChangedInPass = false;
            const textBeforePass = textRange.asString();
            
            // Intentar cada placeholder
            Object.keys(textReplacements).forEach(placeholder => {
              const value = textReplacements[placeholder];
              // IMPORTANTE: Permitir valores vacíos o "0" para que el placeholder sea reemplazado
              // En lugar de dejar el placeholder visible, mostramos el valor o string vacío
              const valueToUse = (value !== undefined && value !== null) ? String(value) : '';
              if (textRange.asString().includes(placeholder)) {
                try {
                  // Verificar cuántas veces aparece el placeholder
                  const occurrences = (textRange.asString().match(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g')) || []).length;
                  
                  if (occurrences > 0) {
                    textRange.replaceAllText(placeholder, valueToUse);
                    textChangedInPass = true;
                    slideReplacements += occurrences;
                  }
                } catch (e) {}
              }
            });
            
            // Si no hubo cambios en esta pasada, salir del loop
            if (!textChangedInPass) break;
          }
          
          // Verificar placeholders no reemplazados
          const finalText = textRange.asString();
          const unreplaced = finalText.match(/\{\{[^}]+\}\}/g);
          if (unreplaced && unreplaced.length > 0) {
            unreplacedPlaceholders.push(`Diap${slideIndex + 1}-Shape${shapeIndex + 1}: ${unreplaced.join(', ')}`);
          }
        }
      } catch (e) {}
    }
    
    // Reemplazar en tablas con la misma estrategia de 5 pasadas
    const tables = slide.getTables();
    tables.forEach((table, tableIndex) => {
      const rows = table.getNumRows();
      const cols = table.getNumColumns();
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          try {
            const cell = table.getCell(r, c);
            const textRange = cell.getText();
            
            if (textRange) {
              // 5 pasadas también para tablas
              for (let pass = 1; pass <= 5; pass++) {
                let cellChanged = false;
                
                Object.keys(textReplacements).forEach(placeholder => {
                  const value = textReplacements[placeholder];
                  // IMPORTANTE: Permitir valores vacíos o "0" para que el placeholder sea reemplazado
                  const valueToUse = (value !== undefined && value !== null) ? String(value) : '';
                  if (textRange.asString().includes(placeholder)) {
                    try {
                      textRange.replaceAllText(placeholder, valueToUse);
                      cellChanged = true;
                      slideReplacements++;
                    } catch (e) {}
                  }
                });
                
                if (!cellChanged) break;
              }
            }
          } catch (e) {}
        }
      }
    });
    
    totalReplacements += slideReplacements;
  }
  
  // FASE 2: Insertar imágenes
  for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
    const slide = slides[slideIndex];
    const shapes = slide.getShapes();
    
    // Procesar de atrás hacia adelante para evitar problemas de índices
    for (let shapeIndex = shapes.length - 1; shapeIndex >= 0; shapeIndex--) {
      try {
        const shape = shapes[shapeIndex];
        const textRange = shape.getText();
        
        if (textRange) {
          const shapeText = textRange.asString();
          // Buscar fotos O mapa
          const imageMatch = shapeText.match(/\{\{(foto_[1-6]|mapa)\}\}/);
          
          if (imageMatch) {
            const placeholder = imageMatch[0];
            const imageUrl = imageReplacements[placeholder];
            
            if (imageUrl && imageUrl.trim() !== '' && imageUrl.startsWith('http')) {
              try {
                const left = shape.getLeft();
                const top = shape.getTop();
                const width = shape.getWidth();
                const height = shape.getHeight();
                
                const response = UrlFetchApp.fetch(imageUrl);
                if (response.getResponseCode() === 200) {
                  const blob = response.getBlob();
                  shape.remove();
                  slide.insertImage(blob, left, top, width, height);
                  totalReplacements++;
                  logs.push(`Imagen insertada: ${placeholder}`);
                } else {
                  shape.remove();
                  logs.push(`Imagen removida (error HTTP ${response.getResponseCode()}): ${placeholder}`);
                }
              } catch (e) {
                shape.remove();
                logs.push(`Imagen removida (error de descarga): ${placeholder}`);
              }
            } else {
              // Remover placeholder de imagen sin URL válida
              shape.remove();
              logs.push(`Placeholder de imagen removido (sin URL válida): ${placeholder}`);
            }
          }
        }
      } catch (e) {}
    }
  }
  
  logs.push(`Total reemplazos: ${totalReplacements}`);
  if (unreplacedPlaceholders.length > 0) {
    logs.push(`Sin reemplazar: ${unreplacedPlaceholders.length} placeholders`);
    unreplacedPlaceholders.forEach(item => logs.push(item));
  }
  
  return logs;
}

/**
 * Inserta capturas de pantalla del Google Sheet como imágenes
 * Usa la URL de exportación de Google Sheets
 */
function insertSheetImages(presentation, spreadsheetId) {
  const logs = [];
  
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const slides = presentation.getSlides();
    
    slides.forEach((slide, slideIndex) => {
      const shapes = slide.getShapes();
      
      // Procesar shapes de atrás hacia adelante
      for (let i = shapes.length - 1; i >= 0; i--) {
        try {
          const shape = shapes[i];
          const text = shape.getText().asString().trim();
          
          Object.keys(SHEET_RANGES).forEach(key => {
            const config = SHEET_RANGES[key];
            
            if (text.includes(config.placeholder)) {
              const sheet = spreadsheet.getSheetByName(config.sheet);
              if (sheet) {
                try {
                  // Obtener posición y tamaño del shape
                  const shapeLeft = shape.getLeft();
                  const shapeTop = shape.getTop();
                  const shapeWidth = shape.getWidth();
                  const shapeHeight = shape.getHeight();
                  
                  // Obtener el gid de la hoja
                  const sheetId = sheet.getSheetId();
                  
                  // Construir URL de exportación como PNG
                  // Formato: /export?format=png&gid=SHEET_ID&range=RANGE
                  const range = encodeURIComponent(config.range);
                  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=png&gid=${sheetId}&range=${range}`;
                  
                  logs.push(`Intentando exportar: ${config.sheet} con URL: ${exportUrl.substring(0, 80)}...`);
                  
                  // Obtener la imagen con autenticación
                  const response = UrlFetchApp.fetch(exportUrl, {
                    headers: {
                      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
                    },
                    muteHttpExceptions: true
                  });
                  
                  const responseCode = response.getResponseCode();
                  logs.push(`Response code: ${responseCode}`);
                  
                  if (responseCode === 200) {
                    const imageBlob = response.getBlob();
                    const contentType = response.getHeaders()['Content-Type'] || '';
                    logs.push(`Content-Type: ${contentType}`);
                    
                    // Verificar que es una imagen
                    if (contentType.includes('image')) {
                      // Remover el shape placeholder
                      shape.remove();
                      
                      // Insertar la imagen
                      slide.insertImage(imageBlob, shapeLeft, shapeTop, shapeWidth, shapeHeight);
                      logs.push(`✓ Imagen insertada: ${config.sheet} (${config.range})`);
                    } else {
                      logs.push(`✗ Respuesta no es imagen: ${contentType}`);
                      shape.remove();
                    }
                  } else {
                    logs.push(`✗ Error HTTP ${responseCode} para ${config.sheet}`);
                    // Intentar sin el parámetro range (captura toda la hoja)
                    try {
                      const fullSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=png&gid=${sheetId}`;
                      const fullResponse = UrlFetchApp.fetch(fullSheetUrl, {
                        headers: {
                          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
                        },
                        muteHttpExceptions: true
                      });
                      
                      if (fullResponse.getResponseCode() === 200) {
                        const fullBlob = fullResponse.getBlob();
                        shape.remove();
                        slide.insertImage(fullBlob, shapeLeft, shapeTop, shapeWidth, shapeHeight);
                        logs.push(`✓ Imagen de hoja completa insertada: ${config.sheet}`);
                      } else {
                        shape.remove();
                        logs.push(`✗ Fallback también falló`);
                      }
                    } catch (fallbackError) {
                      shape.remove();
                      logs.push(`✗ Error en fallback: ${fallbackError.toString()}`);
                    }
                  }
                  
                } catch (exportError) {
                  logs.push(`Error exportando ${config.sheet}: ${exportError.toString()}`);
                  shape.remove();
                }
              } else {
                logs.push(`Hoja no encontrada: ${config.sheet}`);
              }
            }
          });
        } catch (e) {
          logs.push(`Error procesando shape: ${e.toString()}`);
        }
      }
    });
  } catch (e) {
    logs.push(`Error general en insertSheetImages: ${e.toString()}`);
  }
  
  return logs;
}

/**
 * Función para capturar screenshots de rangos específicos del Google Sheet
 */
function captureScreenshot(requestData) {
  const logs = [];
  
  try {
    const spreadsheetId = requestData.spreadsheet_id;
    const range = requestData.range;
    const sheetName = requestData.sheet_name || 'Resumen';
    
    logs.push(`Intentando capturar: ${sheetName} - ${range}`);
    
    // Abrir el spreadsheet
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      return {
        success: false,
        error: `Hoja '${sheetName}' no encontrada`,
        logs: logs
      };
    }
    
    // Obtener el ID de la hoja (gid)
    const sheetId = sheet.getSheetId();
    
    // Construir URL de exportación como PNG
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=png&gid=${sheetId}&range=${encodeURIComponent(range)}`;
    
    logs.push(`URL de exportación: ${exportUrl}`);
    
    // Obtener la imagen con autenticación
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    logs.push(`Código de respuesta: ${responseCode}`);
    
    if (responseCode === 200) {
      const imageBlob = response.getBlob();
      const contentType = response.getHeaders()['Content-Type'] || '';
      logs.push(`Tipo de contenido: ${contentType}`);
      
      // Verificar que es una imagen
      if (contentType.includes('image')) {
        // Convertir a base64
        const base64Image = Utilities.base64Encode(imageBlob.getBytes());
        
        return {
          success: true,
          image_base64: base64Image,
          content_type: contentType,
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          range: range,
          logs: logs
        };
      } else {
        logs.push(`ERROR: Respuesta no es imagen: ${contentType}`);
        
        // Intentar sin el parámetro range (captura toda la hoja)
        try {
          const fullSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=png&gid=${sheetId}`;
          logs.push(`Intentando con hoja completa: ${fullSheetUrl}`);
          
          const fullResponse = UrlFetchApp.fetch(fullSheetUrl, {
            headers: {
              'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
            },
            muteHttpExceptions: true
          });
          
          if (fullResponse.getResponseCode() === 200) {
            const fullBlob = fullResponse.getBlob();
            const base64Image = Utilities.base64Encode(fullBlob.getBytes());
            
            logs.push('✓ Hoja completa capturada exitosamente');
            
            return {
              success: true,
              image_base64: base64Image,
              content_type: fullResponse.getHeaders()['Content-Type'] || 'image/png',
              spreadsheet_id: spreadsheetId,
              sheet_name: sheetName,
              range: 'full_sheet',
              logs: logs
            };
          } else {
            logs.push(`✗ Fallback también falló: ${fullResponse.getResponseCode()}`);
          }
        } catch (fallbackError) {
          logs.push(`✗ Error en fallback: ${fallbackError.toString()}`);
        }
        
        return {
          success: false,
          error: `Respuesta no válida: ${contentType}`,
          logs: logs
        };
      }
    } else {
      logs.push(`Error HTTP: ${responseCode}`);
      const responseText = response.getContentText();
      logs.push(`Texto de respuesta: ${responseText.substring(0, 200)}...`);
      
      return {
        success: false,
        error: `Error HTTP ${responseCode}: ${responseText}`,
        logs: logs
      };
    }
    
  } catch (error) {
    logs.push(`Error capturando screenshot: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      logs: logs
    };
  }
}

/**
 * Función para autorizar los scopes necesarios (ejecutar una vez manualmente)
 * Esto solicita permisos para acceder a Sheets externos de tu cuenta
 */
function authorizeScopes() {
  // Solicitar permisos de Spreadsheets (incluyendo externos)
  SpreadsheetApp.openById('1glFHAmUVNErj4DrvXypLZjpF1kjqgGKBLykN6NPiuTU'); // Un sheet_id de prueba
  
  // Solicitar permisos de Slides
  SlidesApp.getActivePresentation();
  
  // Solicitar permisos de Drive
  DriveApp.getRootFolder();
  
  // Solicitar permisos de UrlFetch
  UrlFetchApp.fetch('https://www.google.com');
  
  Logger.log('Scopes autorizados correctamente');
}