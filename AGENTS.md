# Frontend — instrucciones de trabajo

- Este directorio es el repositorio privado `Universiry-frontend`, rama de integración `develop`, montado como submódulo del checkout backend para desarrollo conjunto.
- Usa Vite, React, TypeScript y SCSS. Los estilos pertenecen a componentes/capacidades; los tokens compartidos viven en `src/styles/_tokens.scss`.
- El frontend presenta y valida temprano; permisos, validación de dominio y persistencia se aplican en el backend.
- Para cada cambio: escribe pruebas AAA primero, observa RED, implementa GREEN y refactoriza. Incluye estados felices, bordes, errores y permisos visibles.
- Ejecuta `npm test`, `npm run build` y `npm run lint` antes de integrar.
- `VITE_API_TARGET` configura el destino del proxy Vite. Localmente es `http://localhost:8080`; Compose lo establece a `http://backend:8080`.
- No incluir tokens, credenciales, datos estudiantiles reales ni configuración secreta en el código, fixtures o build público. La sesión OIDC se mantiene solo en memoria/sessionStorage de la pestaña; nunca usar localStorage ni imprimir token/claims. React obtiene permisos exclusivamente de `/api/v1/me` y cada capacidad recibe solo los permisos de su propia familia; el servidor aplica la autorización final.
- La ruta `/#academia` es de lectura en este incremento: ordena raíces por `displayOrder` del nodo, hijos por orden de relación (luego orden/código del hijo), afiliaciones por su `displayOrder` y lugares con las mismas reglas; muestra periodos públicos OPEN. No inferir afiliaciones desde texto histórico ni incluir controles de apertura administrativa sin SSO y permisos reales.
- Mantener separados el semestre curricular de una asignatura y el periodo académico regular/intersemestral; no crear calendarios, periodos o datos oficiales ficticios para llenar estados vacíos.
