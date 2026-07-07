# Glosario

Términos de negocio y técnicos del proyecto. Los conceptos de negocio se desarrollan en [DOMAIN.md](DOMAIN.md); la arquitectura en [ARCHITECTURE.md](ARCHITECTURE.md).

## Negocio

| Término | Significado |
|---|---|
| **Novedad (poscontractual)** | Modificación jurídica formal sobre un contrato ya suscrito: adición, prórroga, suspensión, reinicio, cesión, terminación anticipada |
| **Contrato** | Acuerdo suscrito entre la Universidad y un contratista; se identifica por número + vigencia |
| **Vigencia** | Año fiscal del contrato; parte de su identidad (un mismo número puede repetirse en años distintos) |
| **Contratista** | Persona natural o jurídica que ejecuta el contrato |
| **Cedente / Cesionario** | En una cesión: quien entrega el contrato / quien lo recibe |
| **Supervisor** | Responsable institucional que vigila la ejecución; sus oficios avalan las novedades |
| **Ordenador del gasto** | Autoridad que compromete presupuestalmente a la Universidad |
| **Acta** | Documento formal que materializa una novedad; tiene fecha de expedición |
| **Fecha efectiva** | Cuándo una novedad surte efecto realmente (puede diferir de la expedición del acta) |
| **Objeto (del contrato)** | Descripción de lo contratado |
| **Plazo inicial** | Duración pactada, expresada en letras y números: "NUEVE ( 9 ) MESES" |
| **Anular (una novedad)** | Deshacer el último evento jurídico registrado; solo procede sobre la última novedad |
| **En trámite** | Estado de una novedad no concluida (`ENTR` en el legado); bloqueará la creación de otras |
| **Fin anticipado** | Estado del contrato tras una terminación anticipada |
| **Cesión pendiente de póliza** | Estado posterior a una cesión: falta registrar la póliza del cesionario |
| **Póliza / Acta de inicio** | Garantía del nuevo contratista que cierra el trámite de cesión (pendiente: MIG-008) |
| **Regla mes = 30 días** | Convención contable: todo mes equivale a 30 días en cálculos de plazo |
| **SMLMV** | Salario Mínimo Mensual Legal Vigente (constante normativa; su parametrización es TD-006) |
| **Seguimiento Legal** | Nombre funcional de la vista principal (dashboard) en el área jurídica |
| **Ágora** | Sistema administrativo institucional donde también se replican las novedades (`administrativa_amazon_api`) |
| **Ordenador / oficios** | Comunicaciones numeradas y fechadas del supervisor y del ordenador que soportan la solicitud |

## Técnico

| Término | Significado |
|---|---|
| **MF / microcliente** | Microfrontend; en la jerga institucional OAS, "microcliente" |
| **Root / shell** | `gestion_contractual_root_mf`: orquestador single-spa que registra y monta los MFs |
| **Core** | `core_mf_cliente`: MF transversal con layout, autenticación OAuth2 y menú por rol |
| **Parcel** | Tipo de aplicación single-spa empaquetada como UMD que el root importa |
| **UMD `novedades-mf`** | Formato del artefacto (`main.js`) y nombre de librería con que el root lo consume |
| **Id compuesto** | `${numero}_${vigencia}` — identidad de contrato usada en rutas y consultas |
| **Puerto** | Abstracción de acceso a datos del dominio (`IContractRepository`), implementable por HTTP o mock |
| **Capa anticorrupción** | DTOs + mappers que traducen el esquema laxo del backend legado al dominio limpio |
| **Draft** | Objeto tipado (`NoveltyDraft`) que un formulario construye para enviar una novedad |
| **mid / crud** | Convención backend OAS: API de orquestación (`novedades_mid`) vs. API de persistencia (`novedades_crud`) |
| **`AlertResponse`** | Envoltorio estándar `{Code, Body}` de las respuestas del mid |
| **WSO2** | Gateway/IdP institucional; exige `Authorization: Bearer` en cada petición |
| **Zoneless** | La app no usa zone.js para change detection; la reactividad es por signals |
| **Design tokens (Stitch)** | Paleta y escalas propias del diseño (`primary`, `surface-container-*`, `stack-md`, `headline-lg`…) definidas en `tailwind.config.js` |
| **Átomo (shared/ui)** | Componente visual genérico reutilizable, agnóstico del dominio |
| **`deployUrl`** | URL pública por ambiente desde la que se resuelven chunks del MF (estándar OAS) |
| **OAS** | Oficina Asesora de Sistemas de la Universidad Distrital; emite los lineamientos |
| **Lineamientos** | Repositorio `udistrital/lineamientos_oas` con los estándares institucionales |
| **Proyecto guía** | `udistrital/solicitudes_sabaticos_mf`: MF de referencia de cómo se aplican los estándares |
| **MIG-XXX / TD-XXX** | Tareas de migración / deudas técnicas del [MIGRATION_PLAN](../MIGRATION_PLAN.md) |
| **ADR** | Architecture Decision Record — [docs/adr/](adr/) |
| **`ponytail:`** | Prefijo de comentario que marca una simplificación deliberada y su techo conocido |
