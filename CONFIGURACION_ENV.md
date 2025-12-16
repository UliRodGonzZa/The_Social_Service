# ⚙️ Configuración de Variables de Entorno

## 🔴 IMPORTANTE: Diferencia entre Emergent y Local

Tu aplicación necesita **diferentes configuraciones** dependiendo de dónde se ejecute.

---

## 📍 Para Tu Máquina LOCAL

Cuando trabajas en tu computadora con Docker:

**Archivo: `/frontend/.env`**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**¿Por qué?**
- Tu backend corre en `uvicorn app.main:app --host 0.0.0.0 --port 8001`
- El frontend necesita conectarse a ese puerto local

---

## 🌐 Para EMERGENT (Ambiente de Desarrollo en la Nube)

Cuando el código está en Emergent:

**Archivo: `/frontend/.env`**
```env
REACT_APP_BACKEND_URL=https://cluster-metrics.preview.emergentagent.com
```

**¿Por qué?**
- El backend en Emergent está expuesto por una URL externa
- No puedes usar `localhost` porque el navegador y el servidor están en diferentes lugares

---

## 🔄 Cómo Cambiar entre Configuraciones

### Opción 1: Manual (Cambiar cada vez)

**Antes de trabajar en LOCAL:**
```bash
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn start
```

**Antes de subir a EMERGENT:**
```bash
cd frontend  
echo "REACT_APP_BACKEND_URL=https://cluster-metrics.preview.emergentagent.com" > .env
# Commit y push
```

### Opción 2: Usar archivos de ejemplo (Recomendado)

He creado dos archivos de ejemplo:

1. **`.env.local.example`** - Para tu máquina
2. **`.env.emergent.example`** - Para Emergent

**Para trabajar en LOCAL:**
```bash
cp .env.local.example .env
yarn start
```

**Para trabajar en EMERGENT:**
```bash
cp .env.emergent.example .env
# Guardar cambios
```

### Opción 3: Sin cambios (Solo para Emergent)

Si quieres que funcione en Emergent sin tocar nada:
- El archivo `api.js` tiene un **fallback automático**
- Si `.env` no existe o está vacío, usa: `https://cluster-metrics.preview.emergentagent.com`

---

## 🚨 Error Común: "No puedo hacer login"

**Síntoma:** La página carga pero no puedes hacer login o ver datos.

**Causa:** El frontend está intentando conectarse al backend en la URL incorrecta.

**Solución:**

1. **Verificar qué URL está usando:**
   - Abrir la consola del navegador (F12)
   - Buscar mensajes como: `"API Base URL: http://localhost:8001"`

2. **Si estás en Emergent y dice `localhost:8001`:**
   ```bash
   # Cambiar el .env
   cd /app/frontend
   echo "REACT_APP_BACKEND_URL=https://cluster-metrics.preview.emergentagent.com" > .env
   
   # Reiniciar frontend
   sudo supervisorctl restart frontend
   ```

3. **Si estás en LOCAL y dice otra URL:**
   ```bash
   # Cambiar el .env
   cd frontend
   echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
   
   # Reiniciar
   # Ctrl+C
   yarn start
   ```

---

## 🧪 Verificar Configuración

### En el Navegador

1. Abrir http://localhost:3000 (o la URL de Emergent)
2. Abrir DevTools (F12)
3. Ir a la pestaña Console
4. Buscar: `"📤 API Base URL: ..."`
5. Verificar que la URL sea correcta para tu entorno

### Desde la Terminal

**Verificar archivo .env:**
```bash
cat frontend/.env
```

**Verificar backend:**
```bash
# En LOCAL
curl http://localhost:8001/api/health

# En EMERGENT
curl https://cluster-metrics.preview.emergentagent.com/api/health
```

---

## 📝 Resumen Rápido

| Entorno | Backend URL | Archivo .env |
|---------|-------------|--------------|
| **LOCAL** (tu PC) | `http://localhost:8001` | Usar `.env.local.example` |
| **EMERGENT** (nube) | `https://cluster-metrics.preview.emergentagent.com` | Usar `.env.emergent.example` |

---

## ⚡ Solución Rápida

**Si algo no funciona:**

1. **Detener frontend** (Ctrl+C o `sudo supervisorctl stop frontend`)
2. **Verificar .env:** `cat frontend/.env`
3. **Corregir URL** según tu entorno
4. **Reiniciar frontend**
5. **Refrescar navegador** (Ctrl+Shift+R)

---

## 💡 Recomendación

Para evitar confusiones:

1. **En tu máquina local:** Mantén `.env` con `http://localhost:8001`
2. **Antes de hacer commit:** No incluyas `.env` en git (está en `.gitignore`)
3. **En Emergent:** La configuración correcta ya está puesta

---

**Nota:** Este cambio de configuración es **normal** en desarrollo web. Todos los proyectos necesitan diferentes URLs para desarrollo local vs producción/staging.
