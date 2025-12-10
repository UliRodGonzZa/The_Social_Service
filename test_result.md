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

## Testing Agent Invocation

### Instructions for Testing Agent:
Necesito que pruebes el flujo completo de creación de posts con las siguientes instrucciones:

1. **Setup**:
   - URL: https://netveil.preview.emergentagent.com
   - Usuario: Se carga automáticamente como "alice" (modo demo)

2. **Test Steps**:
   - Esperar a que la página cargue completamente
   - Localizar el formulario de creación de posts (data-testid="create-post-form")
   - Escribir contenido de prueba en el textarea (data-testid="create-post-content")
   - Hacer clic en el botón "Publicar" (data-testid="create-post-submit")
   - **CAPTURAR**: Todos los errores de consola
   - **CAPTURAR**: Todas las peticiones de red, especialmente la llamada POST
   - **CAPTURAR**: La respuesta del servidor (status code, body)

3. **Expected Behavior**:
   - La petición debería ir a: `https://netveil.preview.emergentagent.com/api/posts/`
   - El payload debería incluir: `{ author_username: "alice", content: "...", tags: [...] }`
   - El servidor debería responder con status 200 y el post creado

4. **What to Report**:
   - URL exacta a la que se está haciendo la petición
   - Payload enviado
   - Status code de la respuesta
   - Cuerpo de la respuesta (o error)
   - Cualquier error en la consola de Javascript

## Incorporate User Feedback
- User confirmó el plan de acción
- Prioridad P0: Resolver error de creación de posts
- Usar testing agent para depuración profunda
