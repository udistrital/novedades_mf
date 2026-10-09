/**
 * Ambiente: PRUEBAS.
 * Nombres de variables institucionales (no cambiar). URLs tal cual el legado.
 */
export const environment = {
    production: false,
    ADMINISTRATIVA_PRUEBAS_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_amazon_api/v1/',
    NOVEDADES_MID_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1/',
    NOVEDADES_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_crud/v1/',
    CORE_AMAZON_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/core_amazon_crud/v1/',
    FINANCIERA_JBPM_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/financiera_jbpm/v1/',
    // Generador de actas: `novedad/generaracta` de novedades_mid, que aún no está
    // desplegado y corre local (rama feature/actas). Cuando se despliegue, la llamada
    // pasa a NOVEDADES_MID_SERVICE y esta variable se elimina.
    ACTAS_MID_SERVICE: 'http://localhost:8081/v1/',
    TOKEN: {
        AUTORIZATION_URL: 'https://autenticacion.portaloas.udistrital.edu.co/oauth2/authorize',
        URL_USER_INFO: 'https://autenticacion.portaloas.udistrital.edu.co/oauth2/userinfo',
        CLIENTE_ID: 'OwOV0X4cpYgbSpDfm_FPKF0J6bwa',
        REDIRECT_URL: 'https://pruebasnovedades.portaloas.udistrital.edu.co',
        RESPONSE_TYPE: 'id_token token',
        SCOPE: 'openid email documento',
        BUTTON_CLASS: 'btn btn-warning btn-sm',
        SIGN_OUT_URL: 'https://autenticacion.portaloas.udistrital.edu.co/oidc/logout',
        SIGN_OUT_REDIRECT_URL: 'https://pruebasnovedades.portaloas.udistrital.edu.co',
        SIGN_OUT_APPEND_TOKEN: 'true'
    }
};
