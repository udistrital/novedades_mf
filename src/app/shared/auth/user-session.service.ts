import { Injectable } from '@angular/core';

/** Claims del JWT que usa el módulo (el shell deposita el token en localStorage). */
export interface UserSession {
  roles: string[];
  documento: string;
  email: string;
}

/** Claves bajo las que el flujo OAuth del shell deja el id_token con los claims de negocio. */
const ID_TOKEN_KEYS = ['id_token', 'access_token', 'token'];

const SESION_VACIA: UserSession = { roles: [], documento: '', email: '' };

/**
 * Sesión del usuario autenticado: decodifica en cliente el payload del JWT
 * emitido por el flujo OAuth2 del shell (claims `role`, `documento`, `email`),
 * igual que hacía el cliente legado. No valida la firma: la autorización real
 * la hace el gateway; estos claims solo controlan la UI (requerimientos §4).
 */
@Injectable({ providedIn: 'root' })
export class UserSessionService {
  /** Sesión actual; se relee del localStorage en cada llamada (el shell puede renovar el token). */
  session(): UserSession {
    const token = ID_TOKEN_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
    if (!token) return SESION_VACIA;
    const payload = decodeJwtPayload(token);
    if (!payload) return SESION_VACIA;
    const role = payload['role'] ?? payload['roles'];
    return {
      roles: Array.isArray(role) ? role.map(String) : role ? [String(role)] : [],
      documento: String(payload['documento'] ?? ''),
      email: String(payload['email'] ?? '')
    };
  }

  /** Usuario para los registros del backend, con el prefijo del legado: "CC{documento}". */
  usuarioRegistro(): string {
    const doc = this.session().documento;
    return doc ? `CC${doc}` : 'MID'; // 'MID' es el default que asume el propio backend.
  }
}

/** Payload (segundo segmento) de un JWT, decodificado como base64url; null si no es un JWT. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
