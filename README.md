# Facturapp — frontend para Netlify

Frontend nuevo y mínimo de Facturapp con React + Vite, pensado para desplegarse en Netlify y reutilizar el proyecto Supabase existente. No incluye backend, claves privadas ni funciones de emisión.

## Configuración local
1. Instalar Node.js 20.19+ (LTS).
2. Copiar `.env.example` a `.env.local`.
3. Completar `VITE_SUPABASE_ANON_KEY` con la clave **publicable/anon** del proyecto Supabase. Nunca usar `service_role` ni una clave secreta en el frontend.
4. Ejecutar `npm install`, `npm run dev`.
5. Validar con `npm test` y `npm run build`.

## Despliegue en Netlify
1. Subir este proyecto a un repositorio GitHub nuevo (o importar la carpeta desde Git).
2. En Netlify, Add new site → Import an existing project → elegir el repositorio.
3. Build command: `npm run build`; publish directory: `dist`.
4. En Site configuration → Environment variables, agregar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy preview primero. No configurar producción hasta validar login y chat.

## IMPORTANTE: autorizar el dominio en la Edge Function existente
La función `chat-api` actual tiene una lista de orígenes permitidos codificada en `ALLOWED_ORIGINS`. Antes de que funcione el chat desde el dominio Netlify, el administrador deberá agregar el dominio exacto del sitio (por ejemplo `https://nombre-del-sitio.netlify.app`) a esa lista y desplegar la función actualizada. No cambiar los secretos, las políticas RLS ni la base de datos para esta tarea. No deshabilitar CORS.

## Límites intencionales
- Usa exclusivamente `chat-api` para las operaciones de chat y listado de emisores.
- La sesión se maneja con Supabase Auth.
- No se implementa confirmación ni emisión de comprobantes. El backend existente responde `409` si se intenta confirmar.
- La app solo presenta borradores preliminares y respuestas del asistente.
