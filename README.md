# BIS Seguridad — Panel de monitoreo

Panel web para monitoreo de DVRs Hikvision. Lee automáticamente los mails de alerta y los muestra en tiempo casi real.

---

## Stack

- **Next.js 14** — frontend + API routes
- **Supabase** — base de datos + autenticación (gratuito)
- **Vercel** — hosting + cron jobs (gratuito)
- **Gmail IMAP** — lectura de alertas del DVR

---

## Setup paso a paso

### 1. Supabase

1. Crear cuenta en [supabase.com](https://supabase.com)
2. Crear un nuevo proyecto
3. Ir a **SQL Editor** y ejecutar todo el contenido de `supabase/schema.sql`
4. Ir a **Project Settings → API** y copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GMAIL_USER=eventosbisseguridad@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
CRON_SECRET=inventar_una_clave_larga_y_aleatoria
```

### 3. Crear el primer usuario admin

1. Ir a **Supabase → Authentication → Users → Add user**
2. Crear el usuario con email y contraseña
3. Ir a **Table Editor → profiles** y cambiar el campo `role` de ese usuario a `admin`

### 4. GitHub + Vercel

1. Crear repo en GitHub y pushear este código
2. Conectar el repo en [vercel.com](https://vercel.com)
3. En Vercel, ir a **Settings → Environment Variables** y cargar todas las variables de `.env.local`
4. El cron (`vercel.json`) va a correr automáticamente cada minuto en producción

### 5. Verificar que funciona

1. Acceder a `https://tu-dominio.vercel.app/login`
2. Ingresar con el usuario admin
3. Desconectar una cámara del DVR54
4. Esperar ~1-2 minutos
5. El evento debe aparecer en el panel admin

---

## Estructura del proyecto

```
app/
  login/          → Página de login
  dashboard/      → Vista para clientes
  admin/          → Vista para administradores
  api/poll-emails → Cron que lee Gmail y guarda eventos
components/
  Navbar.tsx
  EventBadge.tsx
lib/
  supabase.ts       → Cliente browser
  supabase-server.ts → Cliente server + service role
  emailParser.ts    → Parser de mails Hikvision
supabase/
  schema.sql        → Estructura de la base de datos
vercel.json         → Configuración del cron (cada 1 minuto)
```

---

## Agregar más DVRs

1. En **Supabase → Table Editor → substations**: agregar la subestación
2. En **dvrs**: agregar el DVR con el `device_name` exacto que tiene configurado en Hikvision
3. Configurar el DVR para que mande alertas a `eventosbisseguridad@gmail.com` (mismo proceso que DVR54)

---

## Colores de eventos

| Color | Evento |
|-------|--------|
| Rojo | Video Loss (pérdida de señal) |
| Amarillo | Motion Detection |
| Naranja | HDD / Disco |
| Violeta | Tamper (manipulación) |
| Azul | Otros |
