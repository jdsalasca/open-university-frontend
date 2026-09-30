# Universiry frontend

Repositorio privado `Universiry-frontend`, rama de integración `develop`. Construye el monolito web institucional con Vite, React, TypeScript y SCSS.

## Requisitos y comandos

Requiere Node.js 24 y npm. Desde esta carpeta:

```powershell
npm ci
npm test
npm run build
npm run lint
npm run dev
```

Vite sirve la interfaz en `http://localhost:5173` y por defecto proxifica `/api` y `/assets` a `http://localhost:8080`. Compose sobrescribe el destino mediante `VITE_API_TARGET=http://backend:8080` y activa HMR al guardar fuentes SCSS/TSX.

## Límites

La identidad descargada se valida antes de aplicar colores, activos y etiquetas. El cliente no concede permisos: publicar identidad exige token y rol validados por backend. La imagen local de preview no equivale a un cambio institucional publicado. No usar secretos ni datos personales reales en el frontend.
