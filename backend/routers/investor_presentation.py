"""
Router para generar presentaciones de inversionistas via Google AppScript
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from config.db_connection import engine
from models.valuation import Valuation
from models.investor_tenant import InvestorTenantInfo
from models.property_images import PropertyImage
from models.payment_plan_dashboard import PaymentPlanDashboard
from datetime import datetime
import os
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investor-presentation", tags=["investor-presentation"])

class PresentationRequest(BaseModel):
    """Modelo para solicitar generación de presentación"""
    valuation_id: int
    investment_amount: Optional[float] = None
    investor_name: Optional[str] = None
    investor_email: Optional[str] = None

class PresentationResponse(BaseModel):
    """Respuesta con URL de la presentación generada"""
    success: bool
    presentation_url: Optional[str] = None
    message: Optional[str] = None

@router.post("/generate")
async def generate_investor_presentation(request: PresentationRequest) -> PresentationResponse:
    """Generar presentación de inversionista via AppScript"""
    try:
        logger.info(f"Starting presentation generation for valuation_id: {request.valuation_id}")
        with Session(engine) as session:
            # Obtener valuación
            valuation = session.get(Valuation, request.valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            # Obtener información del inquilino
            tenant_info = session.exec(
                select(InvestorTenantInfo).where(
                    InvestorTenantInfo.valuation_id == request.valuation_id
                )
            ).first()
            
            # Obtener imágenes regulares (no fachada)
            from sqlalchemy import or_
            regular_images = session.exec(
                select(PropertyImage)
                .where(PropertyImage.valuation_id == request.valuation_id)
                .where(or_(PropertyImage.is_facade == False, PropertyImage.is_facade == None))
                .order_by(PropertyImage.image_order)
                .limit(6)  # Limitar a 6 imágenes regulares
            ).all()
            
            # Obtener imagen de fachada
            facade_image = session.exec(
                select(PropertyImage)
                .where(PropertyImage.valuation_id == request.valuation_id)
                .where(PropertyImage.is_facade == True)
            ).first()
            
            # Preparar URLs de las imágenes para el AppScript (URLs directas de Google Cloud Storage)
            image_urls = {}
            # Imágenes regulares: foto_1 a foto_6
            for i in range(1, 7):  # foto_1 a foto_6
                if i <= len(regular_images) and regular_images[i-1].image_path:
                    image_path = regular_images[i-1].image_path
                    
                    # Si image_path ya es una URL completa de Google Cloud Storage, usarla directamente
                    if image_path.startswith('https://storage.googleapis.com/'):
                        image_urls[f"foto_{i}"] = image_path
                    # Si es una ruta relativa, construir la URL completa de Google Cloud Storage
                    elif image_path.startswith('http'):
                        # Ya es una URL completa, usarla directamente
                        image_urls[f"foto_{i}"] = image_path  
                    else:
                        # Es una ruta relativa, construir URL de Google Cloud Storage
                        bucket_name = os.getenv('GCS_BUCKET_NAME', 'toperty-appraisals')
                        image_urls[f"foto_{i}"] = f"https://storage.googleapis.com/{bucket_name}/{image_path}"
                    
                    logger.info(f"Foto {i} URL: {image_urls[f'foto_{i}']}")
                else:
                    image_urls[f"foto_{i}"] = ""  # Vacío si no hay imagen
            
            # Agregar imagen de fachada como foto_7
            if facade_image and facade_image.image_path:
                image_path = facade_image.image_path
                
                # Si image_path ya es una URL completa de Google Cloud Storage, usarla directamente
                if image_path.startswith('https://storage.googleapis.com/'):
                    image_urls["foto_7"] = image_path
                    logger.info(f"URL ya es de GCS: {image_path[:100]}...")  # Log first 100 chars
                else:
                    # Es una ruta relativa, construir URL completa de GCS
                    bucket_name = os.getenv('GCS_BUCKET_NAME', 'toperty-appraisals')
                    image_urls["foto_7"] = f"https://storage.googleapis.com/{bucket_name}/{image_path}"
                
                logger.info(f"Foto 7 (Fachada) URL: {image_urls['foto_7']}")
            else:
                image_urls["foto_7"] = ""  # Vacío si no hay imagen de fachada
            
            # Obtener datos del dashboard
            dashboard = session.exec(
                select(PaymentPlanDashboard).where(
                    PaymentPlanDashboard.valuation_name == valuation.valuation_name
                )
            ).first()
            
            # Función auxiliar para limpiar valores monetarios
            def clean_currency(value_str: Any) -> float:
                if not value_str:
                    return 0
                # Convertir a string y limpiar
                clean_str = str(value_str).replace('$', '').strip()
                
                # Detectar formato: si tiene coma como último separador decimal (ej: 1.300.000,50)
                # o si tiene punto como decimal (ej: 1,300,000.50)
                if ',' in clean_str and '.' in clean_str:
                    # Si la coma está después del último punto -> formato latino (1.300.000,50)
                    last_comma = clean_str.rfind(',')
                    last_dot = clean_str.rfind('.')
                    if last_comma > last_dot:
                        # Formato latino: punto es separador de miles, coma es decimal
                        clean_str = clean_str.replace('.', '').replace(',', '.')
                    else:
                        # Formato anglosajón: coma es separador de miles, punto es decimal
                        clean_str = clean_str.replace(',', '')
                elif ',' in clean_str:
                    # Solo tiene comas - podría ser separador de miles o decimal
                    # Si solo hay una coma y menos de 3 dígitos después, es decimal
                    parts = clean_str.split(',')
                    if len(parts) == 2 and len(parts[1]) <= 2:
                        clean_str = clean_str.replace(',', '.')
                    else:
                        clean_str = clean_str.replace(',', '')
                elif '.' in clean_str:
                    # Solo tiene puntos - verificar si es separador de miles o decimal
                    parts = clean_str.split('.')
                    # Si hay múltiples puntos, son separadores de miles
                    if len(parts) > 2:
                        clean_str = clean_str.replace('.', '')
                    # Si el último grupo tiene 3 dígitos, probablemente es separador de miles
                    elif len(parts) == 2 and len(parts[1]) == 3:
                        clean_str = clean_str.replace('.', '')
                    # Si el último grupo tiene 1 o 2 dígitos, es decimal
                    # (lo dejamos como está)
                
                try:
                    return float(clean_str)
                except ValueError:
                    return 0
            
            # Función para convertir property_type de número a texto
            def get_property_type_text(property_type: int) -> str:
                property_types = {
                    1: "Apartamento",
                    2: "Casa",
                    3: "Oficina",
                    4: "Local Comercial",
                    5: "Bodega",
                    6: "Lote",
                    7: "Finca",
                    8: "Apartaestudio"
                }
                return property_types.get(property_type, "Inmueble")
            
            # Preparar datos para la presentación con las variables específicas
            presentation_data = {
                # Variables principales solicitadas
                "nombre_inmueble": valuation.valuation_name,
                # nombre_usuario: Prioridad 1: dashboard.client_name (Excel), 2: request.investor_name, 3: "Inversionista"
                "nombre_usuario": (dashboard.client_name if dashboard else None) or request.investor_name or "Inversionista",
                "descripcion": valuation.description or "Sin descripción",
                "direccion": valuation.valuation_name,
                
                # Información detallada de la propiedad (convertir a string para asegurar que se envían)
                "tipo_propiedad": get_property_type_text(valuation.property_type),
                "area": str(valuation.area) if valuation.area else "0",
                "habitaciones": str(valuation.rooms) if valuation.rooms else "0",
                "banos": str(valuation.baths) if valuation.baths else "0",
                "parqueadero": str(valuation.garages) if valuation.garages else "0",
                "estrato": str(valuation.stratum) if valuation.stratum else "0",
                "antiguedad": str(valuation.antiquity) if valuation.antiquity is not None else "N/A",
                "piso": str(valuation.floor) if valuation.floor is not None else "N/A",
                
                # Información del inquilino (si existe)
                "empleador": tenant_info.employer if tenant_info else "N/A", #Bien
                "score_promedio": tenant_info.credit_score if tenant_info else 0, #Bien
                "fecha_score": tenant_info.score_date.strftime('%d/%m/%Y') if tenant_info and tenant_info.score_date else "N/A", #Bien
                "ingresos_certificados": tenant_info.monthly_income if tenant_info else 0, #Bien
                
                # URLs de las fotos
                **image_urls,  # foto_1, foto_2, ... foto_6 #Bien
            }
            
            # Agregar datos financieros del dashboard
            if dashboard and dashboard.sheet_data:
                flujo_interno = dashboard.sheet_data.get('flujo_interno', {})
                resumen = dashboard.sheet_data.get('resumen', {})
                investor_cash_flow = dashboard.sheet_data.get('investor_cash_flow', {})
                
                # SOBRESCRIBIR datos de la propiedad con los del sheet si existen (son más actualizados)
                if resumen.get('area_construida'):
                    presentation_data["area"] = str(resumen.get('area_construida'))
                if resumen.get('habitaciones'):
                    presentation_data["habitaciones"] = str(resumen.get('habitaciones'))
                if resumen.get('parqueadero'):
                    presentation_data["parqueadero"] = str(resumen.get('parqueadero'))
                if resumen.get('ano_construccion'):
                    # Calcular antigüedad desde año de construcción
                    try:
                        ano = int(resumen.get('ano_construccion'))
                        antiguedad = 2026 - ano  # Año actual
                        presentation_data["antiguedad"] = str(antiguedad)
                    except:
                        pass
                
                # PRIORIDAD: Usar datos de 'resumen' si existen, son los correctos del dashboard de inversionista
                # Valores financieros principales - primero intentar desde resumen
                commercial_value = clean_currency(resumen.get('valor_comercial_toperty', 0)) or clean_currency(flujo_interno.get('commercial_value', 0))
                purchase_price = clean_currency(resumen.get('valor_compra', 0)) or clean_currency(flujo_interno.get('average_purchase_value', 0))
                user_down_payment = clean_currency(resumen.get('cuota_inicial_usuario', 0)) or clean_currency(flujo_interno.get('user_down_payment', 0))
                closing_costs = clean_currency(resumen.get('gastos_cierre', 0)) or (purchase_price * 0.0323 if purchase_price > 0 else 0)
                total_investment = clean_currency(resumen.get('monto_total_inversion', 0)) or (purchase_price + closing_costs - user_down_payment)
                
                # Calcular descuento
                descuento = 0
                if commercial_value > 0 and purchase_price > 0:
                    descuento = ((commercial_value - purchase_price) / commercial_value) * 100
                
                # Obtener administración: PRIORIDAD del formulario, fallback al dashboard
                if valuation.administration_fee and valuation.administration_fee > 0:
                    administracion = valuation.administration_fee
                    logger.info(f"Usando administracion del formulario: {administracion}")
                else:
                    administracion = clean_currency(resumen.get('cuota_administracion', 0)) or clean_currency(flujo_interno.get('administracion', 0))
                
                # Canon de arrendamiento desde resumen
                canon_arrendamiento = clean_currency(resumen.get('canon_arrendamiento', 0))
                
                # cuota_mensual_total: PRIORIDAD del formulario (tenant_info.monthly_payment)
                # Fallback 1: flujo_interno.user_monthly_payment del sheet
                # Fallback 2: canon de arrendamiento
                if tenant_info and tenant_info.monthly_payment and tenant_info.monthly_payment > 0:
                    user_monthly_payment = tenant_info.monthly_payment
                    logger.info(f"Usando tenant_info.monthly_payment del formulario: {user_monthly_payment}")
                else:
                    user_monthly_payment = clean_currency(flujo_interno.get('user_monthly_payment', 0))
                    if user_monthly_payment == 0 and canon_arrendamiento > 0:
                        user_monthly_payment = canon_arrendamiento
                        logger.info(f"Usando canon_arrendamiento como cuota_mensual_total: {user_monthly_payment}")
                
                # Obtener métricas financieras DIRECTAMENTE desde 'resumen' (son los valores correctos del dashboard)
                # IMPORTANTE: Los valores vienen como decimales (0.17 = 17%), necesitan multiplicarse por 100 para porcentajes
                
                # multiplo_inversion - 'Múltiplo de la Inversión' en el dashboard de inversionista
                multiplo_inversion = resumen.get('multiplo_inversion', 0)
                if multiplo_inversion:
                    if isinstance(multiplo_inversion, str):
                        multiplo_inversion = float(multiplo_inversion.replace(',', '.').replace('x', '').strip()) if multiplo_inversion else 0
                    else:
                        multiplo_inversion = float(multiplo_inversion)
                else:
                    multiplo_inversion = 0
                
                # tir - 'Retornos Estimados Anuales' en el dashboard de inversionista
                # Viene como decimal (ej: 0.17 = 17%)
                tir = resumen.get('retornos_estimados', 0)
                if tir:
                    if isinstance(tir, str):
                        tir = float(tir.replace('%', '').replace(',', '.').strip()) if tir else 0
                    else:
                        tir = float(tir)
                    # Si es menor a 1, es decimal, convertir a porcentaje
                    if tir < 1:
                        tir = tir * 100
                else:
                    tir = 0
                
                # cash_on_cash - 'Cash-on-cash Yield % Año 1' en el dashboard de inversionista
                # Viene como decimal (ej: 0.11 = 11%)
                cash_on_cash = resumen.get('cash_on_cash_yield', 0)
                if cash_on_cash:
                    if isinstance(cash_on_cash, str):
                        cash_on_cash = float(cash_on_cash.replace('%', '').replace(',', '.').strip()) if cash_on_cash else 0
                    else:
                        cash_on_cash = float(cash_on_cash)
                    # Si es menor a 1, es decimal, convertir a porcentaje
                    if cash_on_cash < 1:
                        cash_on_cash = cash_on_cash * 100
                else:
                    cash_on_cash = 0
                
                # Log para debug
                logger.info(f"Datos de resumen: multiplo={multiplo_inversion}, tir={tir}%, cash_on_cash={cash_on_cash}%")
                logger.info(f"Datos financieros: valor_inmueble={commercial_value}, valor_compra={purchase_price}, gastos_cierre={closing_costs}")
                logger.info(f"Cuota inicial (cuota_inicial_usuario): {user_down_payment}, Inversión total: {total_investment}")
                
                presentation_data.update({
                    "valor_inmueble": commercial_value,
                    "valor_compra": purchase_price,
                    "cuota_inicial": user_down_payment,
                    "inversion_total": total_investment,
                    "descuento_compra": round(descuento, 2),
                    "gastos_cierre": closing_costs,
                    "administracion": administracion,
                    "multiplo_inversion": round(multiplo_inversion, 2) if multiplo_inversion else 0,
                    "tir": round(tir, 2) if tir else 0,  # Porcentaje con 2 decimales (11.98)
                    "cash_on_cash": round(cash_on_cash, 2) if cash_on_cash else 0,  # Porcentaje con 2 decimales (8.25)
                    "cuota_mensual_total": user_monthly_payment,
                    "canon_arrendamiento": canon_arrendamiento,
                })
                
                # Calcular relaciones cuota/ingresos si hay inquilino
                if tenant_info and tenant_info.monthly_income > 0 and tenant_info.monthly_payment > 0:
                    # Ingresos/Cuota (Multiplicador) - Cuántas veces los ingresos cubren la cuota
                    ingresos_cuota = round(tenant_info.monthly_income / tenant_info.monthly_payment, 2)
                    # Cuota/Ingresos (Porcentaje) - Qué porcentaje de los ingresos representa la cuota
                    cuota_ingresos = round((tenant_info.monthly_payment / tenant_info.monthly_income) * 100, 2)
                    
                    presentation_data.update({
                        "ingresos_cuota": ingresos_cuota,  # Multiplicador Debe ser decimal
                        "cuota_ingresos": cuota_ingresos,  # Porcentaje Debe ser decimal
                    })
                else:
                    presentation_data.update({
                        "ingresos_cuota": 0,
                        "cuota_ingresos": 0,
                    })
            
            # Preparar URLs de imágenes (solo si hay)
            imagenes = []
            if regular_images:
                for img in regular_images:
                    if img.image_path and img.image_path.startswith('http'):
                        imagenes.append(img.image_path)
            
            # Solo agregar imágenes si existen
            presentation_data["imagenes"] = imagenes if imagenes else []
            
            # Generar URL del mapa estático si hay coordenadas
            if valuation.latitude and valuation.longitude:
                google_maps_key = os.getenv('GOOGLE_API_KEY', '')
                if google_maps_key:
                    map_url = (
                        f"https://maps.googleapis.com/maps/api/staticmap?"
                        f"center={valuation.latitude},{valuation.longitude}"
                        f"&zoom=16&size=800x600&scale=2&maptype=roadmap"
                        f"&markers=color:red%7Csize:mid%7C{valuation.latitude},{valuation.longitude}"
                        f"&key={google_maps_key}"
                    )
                    # Agregar mapa como placeholder para la presentación
                    presentation_data["mapa"] = map_url
                    logger.info(f"URL del mapa generada: {map_url[:80]}...")
            
            # URL del AppScript webhook
            appscript_url = os.getenv('APPSCRIPT_PRESENTATION_URL')
            logger.info(f"AppScript URL configured: {bool(appscript_url)}")
            
            if not appscript_url:
                logger.error("AppScript URL not configured")
                raise HTTPException(
                    status_code=500, 
                    detail="AppScript URL no configurada. Agregar APPSCRIPT_PRESENTATION_URL al archivo .env"
                )
            
            # Log detallado de los datos
            logger.info(f"Sending data to AppScript with {len(presentation_data)} fields")
            
            # Formatear valores monetarios sin símbolo $ y con formato correcto
            formatted_data = {}
            for key, value in presentation_data.items():
                if value is None:
                    formatted_data[key] = ""
                elif isinstance(value, (int, float)):
                    # PRIMERO: Verificar ratios/multiplicadores (tienen prioridad para evitar conflictos con 'cuota')
                    if any(x in key for x in ['multiplo', 'ingresos_cuota', 'cuota_ingresos']):
                        # Formatear como multiplicador/ratio con 2 decimales para mayor precisión
                        formatted_data[key] = f"{value:.2f}"
                    # SEGUNDO: Verificar porcentajes
                    elif any(x in key for x in ['descuento', 'tir', 'cash_on_cash']):
                        # Formatear como porcentaje sin símbolo % con 2 decimales
                        formatted_data[key] = f"{value:.2f}"
                    # TERCERO: Valores monetarios (ya no incluye cuota_ingresos ni ingresos_cuota)
                    elif any(x in key for x in ['valor', 'cuota_inicial', 'cuota_mensual', 'inversion', 'administracion', 'ingresos_certificados', 'canon', 'gastos']):
                        # Formatear como número con separadores de miles
                        formatted_data[key] = "{:,.0f}".format(value).replace(',', '.')
                    else:
                        # Otros números, mantener como están
                        formatted_data[key] = str(value)
                else:
                    formatted_data[key] = str(value) if value else ""
            
            # Usar los datos formateados
            presentation_data = formatted_data
            
            # Agregar versiones en millones de los valores financieros
            def format_in_millions(value):
                """Convierte valores a formato de millones"""
                if not value or value == "0":
                    return "0"
                
                try:
                    # Limpiar el valor de formato
                    clean_value = str(value).replace(".", "").replace(",", "")
                    num_value = float(clean_value)
                    
                    if num_value == 0:
                        return "0"
                    
                    # Convertir a millones
                    millions = num_value / 1000000
                    
                    # Formatear según el rango
                    if millions >= 1000:
                        # Miles de millones
                        result = f"{millions/1000:.3f}".rstrip('0').rstrip('.')
                    elif millions >= 1:
                        # Millones
                        result = f"{millions:.3f}".rstrip('0').rstrip('.')
                    else:
                        # Menos de un millón
                        result = f"{millions:.6f}".rstrip('0').rstrip('.')
                    
                    # Reemplazar punto por coma para formato latino
                    return result.replace(".", ",")
                except:
                    return "0"
            
            # Función para formato corto: 1.300.000.000 → 1.300 (millones con separador de miles)
            def format_short(value):
                """Convierte valores a formato corto en millones: 1.300.000.000 → 1.300"""
                if not value or value == "0":
                    return "0"
                
                try:
                    # Limpiar el valor de formato
                    clean_value = str(value).replace(".", "").replace(",", "")
                    num_value = float(clean_value)
                    
                    if num_value == 0:
                        return "0"
                    
                    # Convertir a millones y redondear
                    millions = round(num_value / 1000000)
                    
                    # Formatear con separador de miles (punto para formato latino)
                    return "{:,.0f}".format(millions).replace(',', '.')
                except:
                    return "0"
            
            # Agregar campos _millones para valores financieros
            financial_fields = ['valor_inmueble', 'valor_compra', 'cuota_inicial', 
                              'inversion_total', 'administracion', 'cuota_mensual_total',
                              'gastos_cierre', 'ingresos_certificados', 'canon_arrendamiento']
            
            for field in financial_fields:
                if field in presentation_data:
                    # Obtener valor original sin formato
                    original_value = presentation_data.get(field, "0")
                    # Crear versión en millones
                    presentation_data[f"{field}_millones"] = format_in_millions(original_value)
            
            # Agregar campos _corto para valor_inmueble e inversion_total
            # Formato: 1.300.000.000 → 1.300
            short_fields = ['valor_inmueble', 'inversion_total']
            for field in short_fields:
                if field in presentation_data:
                    original_value = presentation_data.get(field, "0")
                    presentation_data[f"{field}_corto"] = format_short(original_value)
                    logger.info(f"Campo {field}_corto: {presentation_data[f'{field}_corto']}")
            
            # Agregar el ID del spreadsheet si existe
            if dashboard:
                # TEMPORAL: Usar un spreadsheet_id de prueba si no hay ninguno
                spreadsheet_id_found = False
                
                # Primero intentar con sheet_id directo
                if dashboard.sheet_id:
                    presentation_data['spreadsheet_id'] = dashboard.sheet_id
                    logger.info(f"Spreadsheet ID agregado desde sheet_id: {dashboard.sheet_id}")
                    spreadsheet_id_found = True
                # Si no, intentar extraerlo de sheet_url
                elif dashboard.sheet_url:
                    import re
                    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', dashboard.sheet_url)
                    if match:
                        presentation_data['spreadsheet_id'] = match.group(1)
                        logger.info(f"Spreadsheet ID extraído de URL: {match.group(1)}")
                        spreadsheet_id_found = True
                # Finalmente, intentar desde sheet_data
                elif dashboard.sheet_data:
                    sheet_url = dashboard.sheet_data.get('spreadsheet_url', '')
                    if sheet_url:
                        import re
                        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', sheet_url)
                        if match:
                            presentation_data['spreadsheet_id'] = match.group(1)
                            logger.info(f"Spreadsheet ID extraído de sheet_data: {match.group(1)}")
                            spreadsheet_id_found = True
                
                # Log si no se encontró spreadsheet_id
                if not spreadsheet_id_found:
                    logger.warning(f"No se encontró spreadsheet_id para valuación {valuation.id}")
            
            # Validar y aplicar valores por defecto para campos críticos
            def validate_and_default(data_dict):
                """Validar datos y aplicar valores por defecto"""
                defaults = {
                    'descripcion': 'Descripción no disponible',
                    'habitaciones': '0',
                    'banos': '0', 
                    'area': '0',
                    'estrato': '0',
                    'parqueadero': '0',
                    'antiguedad': 'No especificado',
                    'piso': 'No especificado',
                    'tipo_propiedad': 'Inmueble',
                    'empleador': 'No especificado',
                    'score_promedio': '0',
                    'fecha_score': 'No disponible',
                    'ingresos_certificados': '0',
                    'valor_inmueble': '0',
                    'valor_compra': '0', 
                    'cuota_inicial': '0',
                    'inversion_total': '0',
                    'administracion': '0',
                    'cuota_mensual_total': '0',
                    'gastos_cierre': '0',
                    'descuento_compra': '0',
                    'multiplo_inversion': '0',
                    'tir': '0',
                    'cash_on_cash': '0',
                    'ingresos_cuota': '0',
                    'cuota_ingresos': '0',
                    'canon_arrendamiento': '0'
                }
                
                validated_data = {}
                missing_count = 0
                
                for key, value in data_dict.items():
                    if value is None or value == "" or (isinstance(value, str) and value.strip() == ""):
                        if key in defaults:
                            validated_data[key] = defaults[key]
                            logger.info(f"Aplicando valor por defecto para {key}: {defaults[key]}")
                            missing_count += 1
                        else:
                            validated_data[key] = ""
                    else:
                        validated_data[key] = str(value).strip() if isinstance(value, str) else str(value)
                
                logger.info(f"Validación completada: {missing_count} campos tenían valores vacíos")
                return validated_data
            
            # Aplicar validación
            presentation_data = validate_and_default(presentation_data)
            
            # Agregar versiones con uppercase para compatibilidad con placeholders en mayúscula
            case_variants = {
                'descripcion': 'Descripcion',
                'cash_on_cash': 'Cash_on_cash'
            }
            
            for lowercase_key, uppercase_key in case_variants.items():
                if lowercase_key in presentation_data:
                    presentation_data[uppercase_key] = presentation_data[lowercase_key]
                    logger.info(f"Agregada variante en mayúscula: {uppercase_key} = {presentation_data[lowercase_key]}")
            
            # Log detallado de todos los campos que se envían
            logger.info(f"=== DATOS VALIDADOS PARA APPSCRIPT ({len(presentation_data)} campos) ===")
            for key, value in presentation_data.items():
                # Mostrar solo primeros 50 caracteres para URLs largas
                display_value = value[:50] + "..." if len(str(value)) > 50 else value
                logger.info(f"  {key}: {display_value}")
            logger.info("=== FIN DATOS VALIDADOS ===")
            
            # Verificar que los placeholders críticos tengan valores
            critical_fields = ['nombre_inmueble', 'nombre_usuario', 'valor_inmueble', 'habitaciones', 'banos']
            all_critical_ok = True
            for field in critical_fields:
                if not presentation_data.get(field) or presentation_data.get(field) in ['0', '', 'No especificado']:
                    logger.warning(f"Campo crítico '{field}' tiene valor por defecto: {presentation_data.get(field)}")
                    all_critical_ok = False
            
            if all_critical_ok:
                logger.info("✓ Todos los campos críticos tienen valores válidos")
            else:
                logger.warning("⚠️ Algunos campos críticos tienen valores por defecto")
            
            # Enviar datos al AppScript con la estructura correcta (timeout aumentado)
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                # El AppScript espera un objeto con action y data
                payload = {
                    "action": "generate_presentation",
                    "data": presentation_data,
                    "property_name": valuation.valuation_name,
                    "investor_email": request.investor_email,
                    "previous_presentation_id": dashboard.presentation_id if dashboard else None
                }
                
                try:
                    response = await client.post(
                        appscript_url,
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        }
                    )
                except httpx.ReadTimeout:
                    logger.error("AppScript timeout - La generación está tardando más de 60 segundos")
                    raise HTTPException(
                        status_code=504,
                        detail="El AppScript está tardando mucho en responder. Esto puede ser por problemas de permisos en el Google Sheets o muchas imágenes que procesar."
                    )
                
                logger.info(f"AppScript response status: {response.status_code}")
                
                if response.status_code != 200:
                    logger.error(f"AppScript error: {response.text[:500]}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error del AppScript (código {response.status_code}). Verificar que el AppScript esté desplegado correctamente como Web App con acceso 'Cualquiera'."
                    )
                
                result = response.json()
                
                # Log de todos los logs del AppScript
                if result.get('logs'):
                    print("\n" + "="*60)
                    print("LOGS DEL APPSCRIPT")
                    print("="*60)
                    for log_line in result.get('logs', []):
                        print(f"  {log_line}")
                    print("="*60 + "\n")
                else:
                    print("No se recibieron logs del AppScript")
                    print(f"Keys en result: {result.keys()}")
                
                # Log detallado de reemplazos
                if result.get('replacementLogs'):
                    logger.info("\n" + "="*60)
                    logger.info("LOGS DETALLADOS DE REEMPLAZOS DEL APPSCRIPT")
                    logger.info("="*60)
                    for log_line in result.get('replacementLogs', []):
                        logger.info(log_line)
                    
                    # Mostrar resumen
                    if result.get('summary'):
                        summary = result.get('summary', {})
                        logger.info("\n" + "="*40)
                        logger.info(f"RESUMEN: Total logs: {summary.get('totalLogs', 0)} | "
                                  f"Exitosos: {summary.get('success', 0)} | "
                                  f"Advertencias: {summary.get('warnings', 0)} | "
                                  f"Errores: {summary.get('errors', 0)}")
                        logger.info("="*40 + "\n")
                
                if result.get('success'):
                    logger.info(f"Presentation generated successfully: {result.get('url')}")
                    # Log debug info del AppScript
                    if result.get('debug'):
                        logger.info(f"AppScript debug: {result.get('debug')}")
                    
                    # Guardar el ID de la nueva presentación en el dashboard
                    if dashboard and result.get('fileId'):
                        with Session(engine) as session:
                            db_dashboard = session.get(PaymentPlanDashboard, dashboard.id)
                            if db_dashboard:
                                db_dashboard.presentation_id = result.get('fileId')
                                db_dashboard.presentation_url = result.get('url')
                                db_dashboard.presentation_created_at = datetime.utcnow()
                                session.add(db_dashboard)
                                session.commit()
                                logger.info(f"Presentation ID guardado en dashboard: {result.get('fileId')}")
                    
                    return PresentationResponse(
                        success=True,
                        presentation_url=result.get('url'),
                        message="Presentación generada exitosamente"
                    )
                else:
                    logger.error(f"AppScript returned error: {result.get('error')}")
                    return PresentationResponse(
                        success=False,
                        message=result.get('error', 'Error desconocido')
                    )
                    
    except HTTPException as he:
        logger.error(f"HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        logger.error(f"Error generating presentation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/check-dashboard/{valuation_id}")
async def check_dashboard_data(valuation_id: int):
    """Verificar qué datos de dashboard existen para una valuación"""
    try:
        with Session(engine) as session:
            # Buscar por valuation_id directo
            dashboard = session.exec(
                select(PaymentPlanDashboard).where(
                    PaymentPlanDashboard.valuation_id == valuation_id
                )
            ).first()
            
            # Si no hay, buscar por nombre
            if not dashboard:
                valuation = session.get(Valuation, valuation_id)
                if valuation:
                    dashboard = session.exec(
                        select(PaymentPlanDashboard).where(
                            PaymentPlanDashboard.valuation_name == valuation.valuation_name
                        )
                    ).first()
            
            if dashboard:
                return {
                    "found": True,
                    "id": dashboard.id,
                    "valuation_id": dashboard.valuation_id,
                    "valuation_name": dashboard.valuation_name,
                    "sheet_id": dashboard.sheet_id,
                    "sheet_url": dashboard.sheet_url,
                    "has_sheet_data": dashboard.sheet_data is not None,
                    "sheet_data_keys": list(dashboard.sheet_data.keys()) if dashboard.sheet_data else []
                }
            else:
                return {
                    "found": False,
                    "message": f"No dashboard found for valuation_id {valuation_id}"
                }
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug/{valuation_id}")
async def debug_presentation_data(valuation_id: int):
    """Debug endpoint para ver los datos que se enviarían al AppScript"""
    try:
        with Session(engine) as session:
            # Obtener valuación
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                return {"error": "Valuación no encontrada"}
            
            # Obtener información del inquilino
            tenant_info = session.exec(
                select(InvestorTenantInfo).where(
                    InvestorTenantInfo.valuation_id == valuation_id
                )
            ).first()
            
            # Obtener datos del dashboard
            dashboard = session.exec(
                select(PaymentPlanDashboard).where(
                    PaymentPlanDashboard.valuation_name == valuation.valuation_name
                )
            ).first()
            
            # Función auxiliar para limpiar valores monetarios
            def clean_currency(value_str: Any) -> float:
                if not value_str:
                    return 0
                clean_str = str(value_str).replace(',', '').replace('$', '').strip()
                try:
                    return float(clean_str)
                except ValueError:
                    return 0
            
            # Preparar datos básicos
            raw_data = {
                "nombre_inmueble": valuation.valuation_name,
                "nombre_usuario": "Debug User",
                "area": valuation.area,
                "habitaciones": valuation.rooms,
                "banos": valuation.baths,
                "parqueadero": valuation.garages,
                "estrato": valuation.stratum,
                "tipo_propiedad": valuation.property_type,
                "antiguedad": valuation.antiquity,
                "piso": getattr(valuation, 'floor', 'N/A'),
            }
            
            # Agregar datos del inquilino si existe
            if tenant_info:
                raw_data.update({
                    "empleador": tenant_info.employer or "N/A",
                    "score_promedio": tenant_info.credit_score or 0,
                    "fecha_score": tenant_info.score_date.strftime('%d/%m/%Y') if tenant_info.score_date else "N/A",
                    "ingresos_certificados": tenant_info.monthly_income or 0,
                })
            else:
                raw_data.update({
                    "empleador": "N/A",
                    "score_promedio": 0,
                    "fecha_score": "N/A", 
                    "ingresos_certificados": 0,
                })
            
            # Agregar datos financieros del dashboard
            if dashboard and dashboard.sheet_data:
                flujo_interno = dashboard.sheet_data.get('flujo_interno', {})
                investor_cash_flow = dashboard.sheet_data.get('investor_cash_flow', {})
                
                commercial_value = clean_currency(flujo_interno.get('commercial_value', 0))
                purchase_price = clean_currency(flujo_interno.get('average_purchase_value', 0))
                user_down_payment = clean_currency(flujo_interno.get('user_down_payment', 0))
                administracion = clean_currency(flujo_interno.get('administracion', 0))
                user_monthly_payment = clean_currency(flujo_interno.get('user_monthly_payment', 0))
                
                # Calcular descuento
                descuento = 0
                if commercial_value > 0:
                    descuento = ((commercial_value - purchase_price) / commercial_value) * 100
                
                # Calcular múltiplo de inversión y cash on cash
                multiplo_inversion = 0
                cash_on_cash = 0
                closing_costs = purchase_price * 0.0323 if purchase_price > 0 else 0
                total_investment = purchase_price + closing_costs - user_down_payment
                
                operational_flows = investor_cash_flow.get('flujo_caja_operativo', []) if investor_cash_flow else []
                if operational_flows and len(operational_flows) > 0 and total_investment > 0:
                    monthly_flow = clean_currency(operational_flows[0])
                    annual_flow = monthly_flow * 12
                    multiplo_inversion = round(annual_flow / total_investment, 2)
                    
                    if user_down_payment > 0:
                        cash_on_cash = round((annual_flow / user_down_payment) * 100, 2)
                
                # TIR del dashboard
                tir = flujo_interno.get('tir', 0)
                if tir:
                    tir = clean_currency(tir) if isinstance(tir, str) else tir
                
                raw_data.update({
                    "valor_inmueble": commercial_value,
                    "valor_compra": purchase_price,
                    "cuota_inicial": user_down_payment,
                    "administracion": administracion,
                    "cuota_mensual_total": user_monthly_payment,
                    "descuento_compra": round(descuento, 1),
                    "multiplo_inversion": multiplo_inversion,
                    "tir": tir,
                    "cash_on_cash": cash_on_cash,
                })
                
                # Calcular relaciones cuota/ingresos si hay inquilino
                if tenant_info and tenant_info.monthly_income > 0 and tenant_info.monthly_payment > 0:
                    ingresos_cuota = round(tenant_info.monthly_income / tenant_info.monthly_payment, 2)
                    cuota_ingresos = round((tenant_info.monthly_payment / tenant_info.monthly_income) * 100, 2)
                    
                    raw_data.update({
                        "ingresos_cuota": ingresos_cuota,
                        "cuota_ingresos": cuota_ingresos,
                    })
                else:
                    raw_data.update({
                        "ingresos_cuota": 0,
                        "cuota_ingresos": 0,
                    })
            else:
                # Si no hay dashboard, poner valores por defecto
                raw_data.update({
                    "valor_inmueble": 0,
                    "valor_compra": 0,
                    "cuota_inicial": 0,
                    "administracion": 0,
                    "cuota_mensual_total": 0,
                    "descuento_compra": 0,
                    "multiplo_inversion": 0,
                    "tir": 0,
                    "cash_on_cash": 0,
                    "ingresos_cuota": 0,
                    "cuota_ingresos": 0,
                })
            
            # Aplicar formateo
            formatted_data = {}
            for key, value in raw_data.items():
                if value is None:
                    formatted_data[key] = ""
                elif isinstance(value, (int, float)):
                    # Si es un valor monetario, formatearlo
                    if any(x in key for x in ['valor', 'cuota', 'inversion', 'administracion', 'ingresos_certificados']):
                        # Formatear como número con separadores de miles
                        formatted_data[key] = "{:,.0f}".format(value).replace(',', '.')
                    elif any(x in key for x in ['descuento', 'tir', 'cash_on_cash']):
                        # Formatear como porcentaje sin símbolo %
                        formatted_data[key] = f"{value:.1f}"
                    elif any(x in key for x in ['multiplo', 'ingresos_cuota', 'cuota_ingresos']):
                        # Formatear como multiplicador/ratio con 2 decimales para mayor precisión
                        formatted_data[key] = f"{value:.2f}"
                    else:
                        # Otros números, mantener como están
                        formatted_data[key] = str(value)
                else:
                    formatted_data[key] = str(value) if value else ""
            
            return {
                "valuation_id": valuation_id,
                "raw_data": raw_data,
                "formatted_data": formatted_data,
                "dashboard_exists": dashboard is not None,
                "tenant_exists": tenant_info is not None
            }
    except Exception as e:
        return {"error": str(e)}

@router.get("/template-variables")
async def get_template_variables():
    """Obtener lista de variables disponibles para la plantilla"""
    return {
        "property_info": [
            "{{ADDRESS}}", "{{PROPERTY_TYPE}}", "{{AREA}}", "{{ROOMS}}",
            "{{BATHS}}", "{{GARAGES}}", "{{STRATUM}}", "{{ANTIQUITY}}",
            "{{DESCRIPTION}}"
        ],
        "financial_info": [
            "{{COMMERCIAL_VALUE}}", "{{PURCHASE_PRICE}}", "{{CLOSING_COSTS}}",
            "{{DOWN_PAYMENT}}", "{{TOTAL_INVESTMENT}}", "{{DISCOUNT_PERCENTAGE}}",
            "{{MONTHLY_CASH_FLOW}}", "{{ANNUAL_RETURN}}"
        ],
        "tenant_info": [
            "{{TENANT_NAME}}", "{{TENANT_INCOME}}", "{{TENANT_PAYMENT}}",
            "{{TENANT_EMPLOYER}}", "{{TENANT_SCORE}}", "{{SCORE_DATE}}"
        ],
        "investor_info": [
            "{{INVESTOR_NAME}}", "{{INVESTOR_EMAIL}}", "{{INVESTMENT_AMOUNT}}"
        ],
        "images": [
            "{{PROPERTY_IMAGE_1}}", "{{PROPERTY_IMAGE_2}}", "{{PROPERTY_IMAGE_3}}",
            "{{PROPERTY_IMAGE_4}}", "{{PROPERTY_IMAGE_5}}", "{{PROPERTY_IMAGE_6}}",
            "{{PROPERTY_MAP}}"
        ],
        "other": [
            "{{CURRENT_DATE}}"
        ]
    }