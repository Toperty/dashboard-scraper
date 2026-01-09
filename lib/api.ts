// API Service Layer for Dashboard
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface CityStatus {
  id: number;
  name: string;
  website_name: string;
  sell_progress: number;
  rent_progress: number;
  sell_pages: string;
  rent_pages: string;
  status: string;
  last_update: string;
  hours_inactive: number;
  properties_today: number;
  properties_total: number;
}

export interface Summary {
  total_cities: number;
  active_cities: number;
  completed_cities: number;
  properties_today: number;
  properties_updated_today: number;
  properties_total: number;
  avg_speed_ms: number;
  last_execution_time?: string;
  recent_errors_count?: number;
  changes?: {
    properties_today_change: number;
    cities_change: number;
    total_change: number;
  };
}

export interface NextExecution {
  city: string;
  type: string;
  scheduled_time: string;
  minutes_remaining: number;
}

export interface Alert {
  level: string;
  city: string;
  message: string;
  timestamp: string;
}

export interface DashboardData {
  summary: Summary;
  cities: CityStatus[];
  next_executions: NextExecution[];
  alerts: Alert[];
  recent_logs: any[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    // Return mock data if API fails
    return getMockData();
  }
}

export async function fetchCities(): Promise<CityStatus[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cities`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching cities:', error);
    return [];
  }
}

export async function fetchSummary(): Promise<Summary> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/summary`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching summary:', error);
    return {
      total_cities: 0,
      active_cities: 0,
      completed_cities: 0,
      properties_today: 0,
      properties_updated_today: 0,
      properties_total: 0,
      avg_speed_ms: 0
    };
  }
}

export interface Property {
  id: number;
  city: string;
  area: number;
  rooms: number;
  price: number;
  offer_type: string;
  creation_date: string;
  last_update: string;
  title?: string;
  finca_raiz_link?: string;
  maps_link?: string;
  latitude?: number;
  longitude?: number;
  baths?: number;
  garages?: number;
  stratum?: number;
  antiquity?: string;  // Ahora es string con el rango formateado
  is_new?: boolean;
  address?: string;  // Campo dirección
  distance?: number; // Campo distancia en metros
}

export interface PropertiesResponse {
  properties: Property[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface CityOption {
  id: number;
  name: string;
}

export interface Valuation {
  id: number;
  valuation_name: string;
  area: number;
  property_type: number;
  rooms: number;
  baths: number;
  garages: number;
  stratum: number;
  antiquity: number;
  latitude: number;
  longitude: number;
  capitalization_rate?: number;
  sell_price_per_sqm?: number;
  rent_price_per_sqm?: number;
  total_sell_price?: number;
  total_rent_price?: number;
  final_price: number;
  has_payment_plan?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValuationsResponse {
  valuations: Valuation[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export async function fetchCitiesList(): Promise<CityOption[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cities/list`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching cities list:', error);
    return [];
  }
}

export async function fetchProperties(
  page: number = 1,
  limit: number = 50,
  filters: {
    city_ids?: number[];
    offer_type?: string;
    min_price?: number;
    max_price?: number;
    min_area?: number;
    max_area?: number;
    rooms?: string[];
    baths?: string[];
    garages?: string[];
    stratums?: (string | number)[];
    antiquity_categories?: number[];
    antiquity_filter?: string;
    property_type?: string[];
    min_sale_price?: number;
    max_sale_price?: number;
    min_rent_price?: number;
    max_rent_price?: number;
    updated_date_from?: string;
    updated_date_to?: string;
    search_address?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
  } = {}
): Promise<PropertiesResponse> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Manejar arrays (como property_type) de forma especial
        if (Array.isArray(value)) {
          value.forEach(item => params.append(key, item.toString()));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    const response = await fetch(`${API_BASE_URL}/api/properties?${params}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching properties:', error);
    return {
      properties: [],
      pagination: {
        page: 1,
        limit: 50,
        total_count: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }
    };
  }
}

export async function fetchValuations(
  page: number = 1,
  limit: number = 10
): Promise<ValuationsResponse> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/api/valuations?${params}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching valuations:', error);
    return {
      valuations: [],
      pagination: {
        page: 1,
        limit: 10,
        total_count: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }
    };
  }
}

export async function deleteValuation(valuationId: number): Promise<{status: string, message: string}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/valuations/${valuationId}`, {
      method: 'DELETE',
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error deleting valuation:', error);
    return {
      status: 'error',
      message: 'Error de conexión al eliminar el avalúo'
    };
  }
}

function getMockData(): DashboardData {
  return {
    summary: {
      total_cities: 5,
      active_cities: 3,
      completed_cities: 1,
      properties_today: 1247,
      properties_updated_today: 2746,
      properties_total: 45678,
      avg_speed_ms: 3200
    },
    cities: [
      {
        id: 1,
        name: "Bogotá",
        website_name: "bogota",
        sell_progress: 90,
        rent_progress: 85,
        sell_pages: "45/50",
        rent_pages: "30/35",
        status: "en_proceso",
        last_update: new Date().toISOString(),
        hours_inactive: 2,
        properties_today: 423,
        properties_total: 12500
      }
    ],
    next_executions: [
      {
        city: "Medellín",
        type: "sell",
        scheduled_time: new Date(Date.now() + 30 * 60000).toISOString(),
        minutes_remaining: 30
      }
    ],
    alerts: [
      {
        level: "warning",
        city: "Cali",
        message: "Sin actividad por 3 horas",
        timestamp: new Date().toISOString()
      }
    ],
    recent_logs: []
  };
}