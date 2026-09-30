# Frontend — instrucciones de trabajo

- Este directorio es el repositorio privado `Universiry-frontend`, rama de integración `develop`, montado como submódulo del checkout backend para desarrollo conjunto.
- Usa Vite, React, TypeScript y SCSS. Los estilos pertenecen a componentes/capacidades; los tokens compartidos viven en `src/styles/_tokens.scss`.
- El frontend presenta y valida temprano; permisos, validación de dominio y persistencia se aplican en el backend.
- Para cada cambio: escribe pruebas AAA primero, observa RED, implementa GREEN y refactoriza. Incluye estados felices, bordes, errores y permisos visibles.
- Ejecuta `npm test`, `npm run build` y `npm run lint` antes de integrar.
- `VITE_API_TARGET` configura el destino del proxy Vite. Localmente es `http://localhost:8080`; Compose lo establece a `http://backend:8080`.
- No incluir tokens, datos estudiantiles reales ni secretos en el cliente. El modo de demostración no debe presentarse como publicación institucional activa.
