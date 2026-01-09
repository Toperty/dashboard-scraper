"""
Servicio de filtros de propiedades reutilizable
"""
from sqlalchemy import and_, or_, cast, Integer
from typing import List, Optional, Dict, Any


def build_rooms_filter(Property, rooms: List[str]):
    """Construir filtro de habitaciones"""
    if not rooms or len(rooms) == 0:
        return None
        
    conditions = []
    for room in rooms:
        if room == "unspecified":
            conditions.append(or_(
                Property.rooms == None,
                Property.rooms == '',
                Property.rooms == 'N/A',
                Property.rooms == 'Sin especificar'
            ))
        elif room.endswith('+'):
            min_value = int(room[:-1])
            conditions.append(and_(
                Property.rooms.regexp_match('^[0-9]+$'),
                cast(Property.rooms, Integer) >= min_value
            ))
        else:
            conditions.append(Property.rooms == room)
    
    return or_(*conditions) if conditions else None


def build_baths_filter(Property, baths: List[str]):
    """Construir filtro de baños"""
    if not baths or len(baths) == 0:
        return None
        
    conditions = []
    for bath in baths:
        if bath == "unspecified":
            conditions.append(or_(
                Property.baths == None,
                Property.baths == '',
                Property.baths == 'N/A',
                Property.baths == 'Sin especificar'
            ))
        elif bath.endswith('+'):
            min_value = int(bath[:-1])
            conditions.append(and_(
                Property.baths.regexp_match('^[0-9]+$'),
                cast(Property.baths, Integer) >= min_value
            ))
        else:
            conditions.append(Property.baths == bath)
    
    return or_(*conditions) if conditions else None


def build_garages_filter(Property, garages: List[str]):
    """Construir filtro de garajes"""
    if not garages or len(garages) == 0:
        return None
        
    conditions = []
    for garage in garages:
        if garage == "unspecified":
            conditions.append(or_(
                Property.garages == None,
                Property.garages == '',
                Property.garages == 'N/A',
                Property.garages == 'Sin especificar'
            ))
        elif garage.endswith('+'):
            min_value = int(garage[:-1])
            conditions.append(and_(
                Property.garages.regexp_match('^[0-9]+$'),
                cast(Property.garages, Integer) >= min_value
            ))
        else:
            conditions.append(Property.garages == garage)
    
    return or_(*conditions) if conditions else None


def build_stratum_filter(Property, stratums: List[str]):
    """Construir filtro de estrato"""
    if not stratums or len(stratums) == 0:
        return None
        
    conditions = []
    for stratum in stratums:
        if stratum == "unspecified":
            conditions.append(or_(
                Property.stratum == None,
                Property.stratum == '',
                Property.stratum == 'Sin especificar'
            ))
        else:
            stratum_str = f"Estrato {stratum}"
            conditions.append(Property.stratum == stratum_str)
    
    return or_(*conditions) if conditions else None


def build_antiquity_filter(Property, antiquity_categories: List[int], antiquity_filter: str = None):
    """Construir filtro de antigüedad"""
    conditions = []
    
    if antiquity_categories and len(antiquity_categories) > 0:
        for category in antiquity_categories:
            if category == 1:
                conditions.extend([
                    Property.antiquity == 'LESS_THAN_1_YEAR',
                    Property.antiquity == 'Menos de 1 año',
                    Property.antiquity == '1'
                ])
            elif category == 2:
                conditions.extend([
                    Property.antiquity == 'FROM_1_TO_8_YEARS',
                    Property.antiquity == '1 a 8 años',
                    Property.antiquity == '2'
                ])
            elif category == 3:
                conditions.extend([
                    Property.antiquity == 'FROM_9_TO_15_YEARS',
                    Property.antiquity == '9 a 15 años',
                    Property.antiquity == '3'
                ])
            elif category == 4:
                conditions.extend([
                    Property.antiquity == 'FROM_16_TO_30_YEARS',
                    Property.antiquity == '16 a 30 años',
                    Property.antiquity == '4'
                ])
            elif category == 5:
                conditions.extend([
                    Property.antiquity == 'MORE_THAN_30_YEARS',
                    Property.antiquity == 'Más de 30 años',
                    Property.antiquity == '5'
                ])
    
    if antiquity_filter == 'unspecified':
        conditions.extend([
            Property.antiquity == 'UNDEFINED',
            Property.antiquity == 'Sin especificar',
            Property.antiquity == None,
            Property.antiquity == ''
        ])
    
    return or_(*conditions) if conditions else None


def build_property_type_filter(Property, property_types: List[str]):
    """Construir filtro de tipo de propiedad"""
    if not property_types or len(property_types) == 0:
        return None
        
    conditions = []
    
    for prop_type in property_types:
        property_type_lower = prop_type.lower()
        
        if property_type_lower == "apartamento":
            conditions.append(and_(
                or_(
                    Property.title.ilike("% apartamento %"),
                    Property.title.ilike("apartamento %"),
                    Property.title.ilike("% apartamento"),
                    Property.title.ilike("% apto %"),
                    Property.title.ilike("apto %"),
                    Property.title.ilike("% apto"),
                    Property.title.ilike("apartamento"),
                    Property.title.ilike("apto")
                ),
                ~Property.title.ilike("%bodega%"),
                ~Property.title.ilike("%local%"),
                ~Property.title.ilike("%oficina%")
            ))
        elif property_type_lower == "casa":
            conditions.append(and_(
                or_(
                    Property.title.ilike("% casa %"),
                    Property.title.ilike("casa %"),
                    Property.title.ilike("% casa"),
                    Property.title.ilike("casa")
                ),
                ~Property.title.ilike("%apartamento%"),
                ~Property.title.ilike("%apto%"),
                ~Property.title.ilike("%bodega%"),
                ~Property.title.ilike("%local%"),
                ~Property.title.ilike("%oficina%")
            ))
        elif property_type_lower == "oficina":
            conditions.append(and_(
                or_(
                    Property.title.ilike("% oficina %"),
                    Property.title.ilike("oficina %"),
                    Property.title.ilike("% oficina"),
                    Property.title.ilike("oficina")
                ),
                ~Property.title.ilike("%apartamento%"),
                ~Property.title.ilike("%casa%"),
                ~Property.title.ilike("%bodega%")
            ))
        elif property_type_lower == "local":
            conditions.append(and_(
                or_(
                    Property.title.ilike("% local %"),
                    Property.title.ilike("local %"),
                    Property.title.ilike("% local"),
                    Property.title.ilike("local")
                ),
                ~Property.title.ilike("%apartamento%"),
                ~Property.title.ilike("%casa%"),
                ~Property.title.ilike("%oficina%")
            ))
        elif property_type_lower == "bodega":
            conditions.append(or_(
                Property.title.ilike("% bodega %"),
                Property.title.ilike("bodega %"),
                Property.title.ilike("% bodega"),
                Property.title.ilike("bodega")
            ))
        elif property_type_lower == "lote":
            conditions.append(or_(
                Property.title.ilike("% lote %"),
                Property.title.ilike("lote %"),
                Property.title.ilike("% lote"),
                Property.title.ilike("lote")
            ))
        elif property_type_lower == "finca":
            conditions.append(or_(
                Property.title.ilike("% finca %"),
                Property.title.ilike("finca %"),
                Property.title.ilike("% finca"),
                Property.title.ilike("finca")
            ))
        else:
            conditions.append(Property.title.ilike(f"%{prop_type}%"))
    
    return or_(*conditions) if conditions else None


def build_price_type_filters(Property, min_sale_price: float = None, max_sale_price: float = None,
                              min_rent_price: float = None, max_rent_price: float = None):
    """Construir filtros de precio por tipo de oferta"""
    sale_conditions = []
    rent_conditions = []
    
    if min_sale_price is not None:
        sale_conditions.append(Property.price >= min_sale_price)
    if max_sale_price is not None:
        sale_conditions.append(Property.price <= max_sale_price)
        
    if min_rent_price is not None:
        rent_conditions.append(Property.price >= min_rent_price)
    if max_rent_price is not None:
        rent_conditions.append(Property.price <= max_rent_price)
    
    price_type_conditions = []
    if sale_conditions:
        price_type_conditions.append(and_(
            Property.offer == 'sell',
            *sale_conditions
        ))
    if rent_conditions:
        price_type_conditions.append(and_(
            Property.offer == 'rent', 
            *rent_conditions
        ))
    
    return or_(*price_type_conditions) if price_type_conditions else None


def format_antiquity(antiquity_value):
    """Convertir valores de antigüedad a formato español"""
    if not antiquity_value:
        return "Sin especificar"
    
    english_to_spanish = {
        'LESS_THAN_1_YEAR': '1',
        'FROM_1_TO_8_YEARS': '2', 
        'FROM_9_TO_15_YEARS': '3',
        'FROM_16_TO_30_YEARS': '4',
        'MORE_THAN_30_YEARS': '5',
        'UNDEFINED': 'Sin especificar'
    }
    
    id_to_spanish = {
        1: "Menos de 1 año",
        2: "1 a 8 años", 
        3: "9 a 15 años",
        4: "16 a 30 años",
        5: "Más de 30 años"
    }
    
    antiquity_str = str(antiquity_value).strip()
    
    if antiquity_str in english_to_spanish:
        mapped_value = english_to_spanish[antiquity_str]
        if mapped_value == 'Sin especificar':
            return mapped_value
        antiquity_str = mapped_value
    
    try:
        antiquity_id = int(antiquity_str)
        return id_to_spanish.get(antiquity_id, "Sin especificar")
    except ValueError:
        antiquity_lower = antiquity_str.lower()
        if any(word in antiquity_lower for word in ['sin especificar', 'undefined', 'n/a', 'none']):
            return "Sin especificar"
        return antiquity_str
