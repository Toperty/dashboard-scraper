// Servicio de geocodificación usando Google Maps API

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  success: boolean;
  error?: string;
}

export class GeocodingService {
  private static apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  /**
   * Convierte una dirección en coordenadas usando Google Maps Geocoding API
   */
  static async geocodeAddress(address: string): Promise<GeocodeResult> {
    if (!this.apiKey) {
      return {
        latitude: 0,
        longitude: 0,
        formatted_address: '',
        success: false,
        error: 'API key no configurada'
      };
    }

    if (!address || address.trim() === '') {
      return {
        latitude: 0,
        longitude: 0,
        formatted_address: '',
        success: false,
        error: 'Dirección vacía'
      };
    }

    try {
      const encodedAddress = encodeURIComponent(address.trim());
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.apiKey}&region=co&language=es`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        return {
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: result.formatted_address,
          success: true
        };
      } else {
        let errorMessage = 'No se pudo geocodificar la dirección';
        
        switch (data.status) {
          case 'ZERO_RESULTS':
            errorMessage = 'No se encontraron resultados para esta dirección';
            break;
          case 'OVER_QUERY_LIMIT':
            errorMessage = 'Límite de consultas excedido';
            break;
          case 'REQUEST_DENIED':
            errorMessage = 'Solicitud denegada';
            break;
          case 'INVALID_REQUEST':
            errorMessage = 'Solicitud inválida';
            break;
        }

        return {
          latitude: 0,
          longitude: 0,
          formatted_address: '',
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('Error en geocodificación:', error);
      return {
        latitude: 0,
        longitude: 0,
        formatted_address: '',
        success: false,
        error: 'Error de conexión con el servicio de geocodificación'
      };
    }
  }

  /**
   * Calcula la distancia entre dos puntos usando la fórmula de Haversine
   * Retorna la distancia en metros
   */
  static calculateDistance(
    lat1: number, 
    lng1: number, 
    lat2: number, 
    lng2: number
  ): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance);
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Valida si las coordenadas están dentro de Colombia (aproximadamente)
   */
  static isValidColombianCoordinates(lat: number, lng: number): boolean {
    // Bounds aproximados de Colombia
    const colombiaBounds = {
      north: 13.5,
      south: -4.5,
      east: -66.5,
      west: -82.0
    };

    return (
      lat >= colombiaBounds.south &&
      lat <= colombiaBounds.north &&
      lng >= colombiaBounds.west &&
      lng <= colombiaBounds.east
    );
  }
}