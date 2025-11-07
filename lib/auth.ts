// Google OAuth Authentication utilities

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: GoogleUser | null;
}

// Client ID de Google OAuth (necesita ser configurado en Google Cloud Console)
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// Verificar si el Client ID está configurado
export function isGoogleAuthConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 0;
}

export class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null
  };
  private listeners: Array<(state: AuthState) => void> = [];

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Suscribirse a cambios de estado de autenticación
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Llamar inmediatamente con el estado actual
    listener(this.authState);
    
    // Retornar función para desuscribirse
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.authState));
  }

  // Inicializar Google OAuth
  async initGoogleAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      // Cargar el script de Google OAuth si no está cargado
      if (!window.google) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          this.setupGoogleAuth();
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        this.setupGoogleAuth();
        resolve();
      }
    });
  }

  private setupGoogleAuth(): void {
    if (typeof window === 'undefined' || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: this.handleGoogleResponse.bind(this),
      auto_select: false,
    });
  }

  private async handleGoogleResponse(response: any): Promise<void> {
    try {
      // Decodificar el JWT token de Google
      const userInfo = this.parseJWT(response.credential);
      
      // Verificar que el email sea de @toperty.co
      if (!userInfo.email.endsWith('@toperty.co')) {
        // Emitir evento personalizado para que el componente pueda manejarlo
        window.dispatchEvent(new CustomEvent('auth-invalid-email', {
          detail: { email: userInfo.email }
        }));
        this.logout();
        return;
      }

      // Actualizar estado
      this.authState = {
        isAuthenticated: true,
        user: {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        }
      };

      // Guardar en localStorage
      localStorage.setItem('auth_user', JSON.stringify(this.authState.user));
      
      this.notifyListeners();
    } catch (error) {
      console.error('Error al procesar respuesta de Google:', error);
      this.logout();
    }
  }

  private parseJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Token JWT inválido');
    }
  }

  // Mostrar popup de login de Google
  signIn(): void {
    if (typeof window === 'undefined' || !window.google) {
      console.error('Google OAuth no está inicializado');
      return;
    }

    window.google.accounts.id.prompt();
  }

  // Cerrar sesión
  logout(): void {
    this.authState = {
      isAuthenticated: false,
      user: null
    };
    
    localStorage.removeItem('auth_user');
    
    if (typeof window !== 'undefined' && window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    this.notifyListeners();
  }

  // Recuperar estado de autenticación del localStorage
  restoreSession(): void {
    if (typeof window === 'undefined') return;

    try {
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        
        // Verificar que siga siendo un email válido
        if (user.email && user.email.endsWith('@toperty.co')) {
          this.authState = {
            isAuthenticated: true,
            user
          };
          this.notifyListeners();
        } else {
          this.logout();
        }
      }
    } catch (error) {
      console.error('Error al restaurar sesión:', error);
      this.logout();
    }
  }

  // Obtener estado actual
  getAuthState(): AuthState {
    return this.authState;
  }

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  // Obtener usuario actual
  getUser(): GoogleUser | null {
    return this.authState.user;
  }
}

// Declaración de tipos globales para Google OAuth
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export default AuthService;