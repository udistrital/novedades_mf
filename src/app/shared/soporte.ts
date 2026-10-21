/**
 * Mesa de ayuda institucional (IRIS): el único canal de soporte del módulo.
 *
 * Vive aquí y no en `environment` porque es la misma en los tres ambientes y no es
 * configuración del despliegue, sino un dato del negocio. La enlazan la pantalla de
 * error y el modal de confirmación.
 */
export const SOPORTE_IRIS_URL = 'https://iris.portaloas.udistrital.edu.co/scp/login.php';
