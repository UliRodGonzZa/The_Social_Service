# Testing Protocol and Results

## Current Testing Session
**Date**: 2024-12-XX
**Issue**: Error al crear posts desde la UI (P0 - Bloqueador Crítico)
**Status**: INVESTIGATING

## Test Plan
1. **Frontend Testing Agent** - Capturar errores de consola y peticiones de red al crear un post
   - Objetivo: Identificar la causa raíz del error "Error al crear el post"
   - Método: Usar Playwright para automatizar la interacción con el formulario de creación
   - Datos a capturar:
     * Errores en la consola del navegador
     * Peticiones HTTP (método, URL, payload, respuesta)
     * Estado de la aplicación React

## Hypothesis
Basado en la revisión de código, el problema identificado es:
- **Archivo**: `/app/frontend/src/services/api.js`
- **Línea 9**: `const API_BASE_URL = 'http://localhost:8001';`
- **Problema**: URL hardcodeada en lugar de usar `process.env.REACT_APP_BACKEND_URL`
- **Impacto**: Las llamadas al backend no están llegando a la URL correcta del proxy NGINX
- **Solución esperada**: Usar la variable de entorno y asegurar que todas las rutas incluyan el prefijo `/api`

## Testing Agent Results - COMPLETED

### Test Execution Summary:
✅ **Test completed successfully** - Problema identificado y documentado

### Critical Findings:

#### 1. **URL de Petición POST Capturada**:
- **URL Detectada**: `http://localhost:8001/posts/`
- **URL Esperada**: `https://netveil.preview.emergentagent.com/api/posts/`
- **❌ PROBLEMA CONFIRMADO**: La aplicación está usando la URL hardcodeada incorrecta

#### 2. **Payload Enviado**:
```json
{
  "author_username": "alice",
  "content": "Este es un post de prueba para debugging", 
  "tags": null
}
```
✅ El payload es correcto y está bien formateado

#### 3. **Errores de Red Capturados**:
- **Error CORS**: `Access to XMLHttpRequest at 'http://localhost:8001/posts/' from origin 'https://netveil.preview.emergentagent.com' has been blocked by CORS policy`
- **Tipo de Error**: `Permission was denied for this request to access the 'unknown' address space`
- **Status**: `net::ERR_FAILED` (la petición nunca llega al servidor)

#### 4. **Errores de Consola JavaScript**:
- `❌ Network Error: Network Error`
- `❌ Failed to create post: Error al crear post`
- **Causa Raíz**: La petición se bloquea por CORS antes de llegar al backend

#### 5. **Comportamiento de la UI**:
- ✅ Formulario funciona correctamente
- ✅ Usuario "alice" se carga automáticamente
- ✅ Botón "Publicar" está habilitado
- ✅ Contenido se escribe correctamente en el textarea
- ❌ Error se muestra al usuario: "Error al crear el post"

### Root Cause Analysis:
El archivo `/app/frontend/src/services/api.js` línea 9 tiene:
```javascript
const API_BASE_URL = 'http://localhost:8001';
```

**Debe cambiarse a**:
```javascript
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://netveil.preview.emergentagent.com';
```

Y todas las rutas del backend deben incluir el prefijo `/api`.

## Incorporate User Feedback
- User confirmó el plan de acción
- Prioridad P0: Resolver error de creación de posts
- Usar testing agent para depuración profunda
