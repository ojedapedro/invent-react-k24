# Inventory Frontend (Simple — Option B)

Este repositorio contiene **solo el frontend** de la aplicación de control de inventario.
Funcionalidades incluidas:
- Subir/descargar Excel (inventario teórico)
- Escaneo por código de barras (input que se limpia automáticamente)
- Comparación teórico vs real y generación de incidencias
- Edición / eliminación de registros
- Exportar reporte de incidencias a PDF
- Historial guardado en localStorage
- Autenticación básica opcional (Firebase suggested) — no incluida por defecto

## Requisitos
- Node.js 18+
- npm o yarn

## Instalación y ejecución local
```bash
# clona el repo
cd inventory-frontend
npm install
npm run dev
```

El frontend corre típicamente en http://localhost:5173 (Vite).

## Notas
- Para producción se recomienda añadir un backend y persistencia remota.
- Ajusta `App.jsx` (ya incluido) si quieres integrar Firebase Auth o una API propia.
