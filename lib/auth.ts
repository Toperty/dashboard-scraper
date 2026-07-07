// Google OAuth Authentication utilities

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  readonly?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: GoogleUser | null;
}

// Client ID de Google OAuth (necesita ser configurado en Google Cloud Console)
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// Base del backend (donde se verifica el credential y se emite la sesión).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  private sessionToken: string | null = null;
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
      // Pre-chequeo de UX en el cliente (la validación AUTORITATIVA la hace el backend).
      const userInfo = this.parseJWT(response.credential);

      // Dominios y correos permitidos
      const allowedDomains = ['@toperty.co', '@valio.com.co'];
      const allowedEmails = ['pipesanchezt2@gmail.com', 'marivigonzalezb@gmail.com'];

      // Verificar que el email sea de un dominio permitido o sea un correo específico
      const isAllowedEmail = allowedDomains.some(domain => userInfo.email.endsWith(domain)) ||
                             allowedEmails.includes(userInfo.email);
      if (!isAllowedEmail) {
        // Emitir evento personalizado para que el componente pueda manejarlo
        window.dispatchEvent(new CustomEvent('auth-invalid-email', {
          detail: { email: userInfo.email }
        }));
        this.logout();
        return;
      }

      // Intercambiar el credential de Google por una SESIÓN del backend: el backend
      // verifica el token contra Google, valida el dominio y devuelve el rol (readonly).
      const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          window.dispatchEvent(new CustomEvent('auth-invalid-email', {
            detail: { email: userInfo.email }
          }));
        }
        this.logout();
        return;
      }
      const data = await res.json();

      // Guardar la sesión propia del backend (se usa como Bearer en cada llamada).
      this.sessionToken = data.token;
      localStorage.setItem('session_token', data.token);

      // Actualizar estado
      this.authState = {
        isAuthenticated: true,
        user: {
          id: userInfo.sub,
          email: data.user?.email || userInfo.email,
          name: data.user?.name || userInfo.name,
          picture: data.user?.picture || userInfo.picture,
          readonly: !!data.user?.readonly,
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
    this.sessionToken = null;

    localStorage.removeItem('auth_user');
    localStorage.removeItem('session_token');

    if (typeof window !== 'undefined' && window.google) {
      window.google.accounts.id.disableAutoSelect();
    }

    this.notifyListeners();
  }

  // ¿El token de sesión del backend sigue vigente? (solo lee el `exp` del payload;
  // la firma la valida el backend en cada mutación)
  private isSessionTokenValid(token: string | null): boolean {
    if (!token) return false;
    try {
      const body = token.split('.')[0];
      const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  // Recuperar estado de autenticación del localStorage
  restoreSession(): void {
    if (typeof window === 'undefined') return;

    try {
      // Sin token de sesión del backend (o vencido) no hay sesión que restaurar:
      // el usuario se vería "logueado" pero toda escritura fallaría con 401.
      // (Cubre también a quienes iniciaron sesión antes de que existiera el token.)
      const sessionToken = localStorage.getItem('session_token');
      if (!this.isSessionTokenValid(sessionToken)) {
        this.logout();
        return;
      }

      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);

        // Dominios y correos permitidos
        const allowedDomains = ['@toperty.co', '@valio.com.co'];
        const allowedEmails = ['pipesanchezt2@gmail.com', 'marivigonzalezb@gmail.com'];

        // Verificar que siga siendo un email válido
        const isAllowedEmail = allowedDomains.some(domain => user.email.endsWith(domain)) ||
                               allowedEmails.includes(user.email);
        if (user.email && isAllowedEmail) {
          this.sessionToken = localStorage.getItem('session_token');
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

  // Token de sesión del backend (para adjuntar como Bearer).
  getSessionToken(): string | null {
    if (this.sessionToken) return this.sessionToken;
    if (typeof window !== 'undefined') return localStorage.getItem('session_token');
    return null;
  }

  // ¿La cuenta actual es de solo lectura? (el enforcement real está en el backend)
  isReadOnly(): boolean {
    return !!this.authState.user?.readonly;
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