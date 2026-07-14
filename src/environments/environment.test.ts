/**
 * Ambiente: PRUEBAS.
 * Nombres de variables institucionales (no cambiar). URLs tal cual el legado;
 * inventario completo por servicio en backend/endpoints_legacy.md §0.
 */
export const environment = {
    production: false,
    ADMINISTRATIVA_PRUEBAS_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_amazon_api/v1/',
    NOVEDADES_MID_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1/',
    NOVEDADES_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_crud/v1/',
    CORE_AMAZON_SERVICE: 'https://autenticacion.portaloas.udistrital.edu.co/apioas/core_amazon_crud/v1/',
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
