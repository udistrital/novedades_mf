import { HttpInterceptorFn } from '@angular/common/http';
import { DEV_TOKEN } from './dev-token'; // TEST TOKEN — borrar junto con dev-token.ts

/** Claves bajo las que el flujo OAuth del shell puede dejar el token; ajustar cuando se confirme la del root. */
const TOKEN_KEYS = ['access_token', 'id_token', 'token'];

/**
 * Adjunta el token OAuth2 a toda petición saliente. El gateway WSO2 exige
 * `Authorization: Bearer <access_token>`; el token lo emite el flujo OAuth2 del
 * shell (config en environment.TOKEN) y queda en localStorage, igual que en el
 * cliente legado.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const stored = TOKEN_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
  const token = stored ?? DEV_TOKEN; // TEST TOKEN — dejar `const token = stored;` al borrar dev-token.ts
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
