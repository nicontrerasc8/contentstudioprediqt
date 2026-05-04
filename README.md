# Content Suite

Content Suite es una plataforma web para construir, usar y gobernar contenido de marca con IA. El flujo central combina manuales de marca, RAG con embeddings, generacion creativa, auditoria multimodal de imagenes y un circuito de aprobacion por roles.

La app esta pensada para equipos de marketing, branding y compliance que necesitan producir piezas rapido sin perder consistencia de marca.

## Lo Que Hace

- Administra marcas con un CRUD completo.
- Genera manuales de marca accionables con Groq.
- Vectoriza los manuales con Gemini Embeddings y los guarda en Supabase pgvector.
- Recupera contexto de marca con RAG antes de generar contenido.
- Genera contenido creativo listo para revisar.
- Audita imagenes con Gemini Vision y valida el resultado final con Groq.
- Guarda trazabilidad local de prompts, modelos, contexto, salidas, errores y latencia.
- Integra Langfuse de forma opcional para observabilidad externa.
- Maneja aprobacion en dos niveles: Aprobador A y Aprobador B.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Frontend | Next.js 15 App Router, React 19, TypeScript |
| UI | TailwindCSS, shadcn/ui local, lucide-react |
| Backend | Route Handlers de Next.js |
| Auth | Supabase Auth email/password |
| Base de datos | Supabase Postgres |
| Vector search | pgvector con `vector(768)` |
| LLM texto | Groq Cloud, API compatible OpenAI |
| Multimodal y embeddings | Gemini API desde Google AI Studio |
| Observabilidad | `ai_traces` local + Langfuse opcional |

## Arquitectura

```text
Usuario autenticado
  |
  v
Next.js App Router
  |
  +-- CRUD de marcas
  |     +-- Groq genera manual de marca
  |     +-- Gemini crea embeddings de 768 dimensiones
  |     +-- Supabase guarda marca + chunks vectorizados
  |
  +-- Creative Engine
  |     +-- Gemini embeddea la consulta
  |     +-- pgvector recupera chunks relevantes
  |     +-- Groq genera contenido con contexto RAG
  |     +-- Groq valida compliance del contenido
  |
  +-- Multimodal Audit
  |     +-- Gemini describe imagen
  |     +-- Gemini extrae etiquetas y senales visuales
  |     +-- Groq compara evidencia contra manual de marca
  |
  +-- Governance
        +-- Aprobador A registra primera revision
        +-- Aprobador B decide solo si A aprobo
```

## Modulos

### 1. CRUD de Marcas

La seccion `CRUD de marcas` permite a cualquier usuario autenticado:

- Crear una marca.
- Editar una marca existente.
- Regenerar su manual al guardar cambios.
- Reemplazar embeddings obsoletos por nuevos embeddings Gemini.
- Eliminar marca y limpiar datos dependientes.
- Consultar marcas disponibles para los demas modulos.

Campos principales:

- Marca
- Producto
- Tono
- Publico objetivo
- Restricciones

Al crear o editar, la app genera un manual completo con Groq, lo divide en chunks y guarda embeddings en `brand_embeddings`.

### 2. Brand Manual

El manual generado incluye:

- Esencia de marca.
- Propuesta de valor.
- Personalidad y voz.
- Mensajes clave.
- Reglas de escritura.
- Reglas visuales descriptivas.
- Palabras permitidas y palabras a evitar.
- Ejemplos correctos e incorrectos.
- Checklist de aprobacion.

Este manual es la fuente de verdad para RAG, creatividad y auditoria.

### 3. Creative Engine

El motor creativo genera piezas usando contexto real del manual de marca.

Tipos soportados:

- `descripcion de producto`
- `guion de video`
- `prompt de imagen`

Flujo:

1. El usuario selecciona una marca.
2. La app recupera contexto con `match_brand_embeddings`.
3. Groq genera el contenido con el contexto RAG.
4. Groq ejecuta una validacion posterior de compliance.
5. La generacion queda guardada como `pendiente` para revision.

### 4. Multimodal Audit

La auditoria multimodal valida imagenes contra el manual de marca.

Flujo:

1. El usuario sube una imagen.
2. Gemini Vision genera una descripcion objetiva.
3. Gemini extrae etiquetas visuales.
4. Gemini calcula senales como tono profesional, estilo premium o riesgo de incumplimiento.
5. Groq compara esa evidencia contra el manual.
6. La app devuelve:
   - `status`: `check` o `rechazado`
   - `score`: 0 a 100
   - `issues`
   - `recommendation`

### 5. Governance

El panel de gobierno centraliza generaciones creativas y auditorias de imagen.

Roles:

| Rol | Puede hacer |
| --- | --- |
| `creador` | Crear marcas, generar contenido y auditar imagenes |
| `aprobador_a` | Revisar primero generaciones y auditorias |
| `aprobador_b` | Dar decision final solo si Aprobador A aprobo |

Nota: el CRUD de marcas esta abierto a todos los usuarios autenticados. Las acciones creativas y de auditoria siguen reservadas al rol `creador`.

## IA y Modelos

### Groq

Groq se usa para tareas de texto y decision:

- Generacion de manuales.
- Generacion creativa.
- Validacion de compliance.
- Auditoria final de marca.

Variables:

```bash
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TEXT_MODEL=openai/gpt-oss-120b
```

### Gemini / Google AI Studio

Gemini se usa para embeddings y multimodal:

- `gemini-embedding-001` para embeddings.
- `gemini-2.5-flash` para vision y analisis multimodal.

Variables:

```bash
GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_VISION_MODEL=gemini-2.5-flash
GEMINI_EMBED_MODEL=gemini-embedding-001
```

La app solicita embeddings con `outputDimensionality: 768`, porque la tabla usa `vector(768)`.

## Base de Datos

El esquema vive en:

```bash
supabase/schema.sql
```

Tablas principales:

| Tabla | Uso |
| --- | --- |
| `profiles` | Perfil, nombre y rol de cada usuario |
| `brands` | Marcas y manuales generados |
| `brand_embeddings` | Chunks vectorizados del manual |
| `content_generations` | Piezas creativas generadas |
| `image_audits` | Auditorias multimodales |
| `approval_reviews` | Revisiones A/B por pieza |
| `ai_traces` | Observabilidad local de IA |

Funciones:

- `match_brand_embeddings`: busqueda semantica con pgvector.
- `current_app_role`: helper RLS para conocer el rol del usuario.
- `touch_updated_at`: actualiza timestamps en tablas con `updated_at`.

RLS esta habilitado en las tablas. La app usa `SUPABASE_SERVICE_ROLE_KEY` solo en Route Handlers del servidor.

## Variables de Entorno

Crea `.env.local` en la raiz:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TEXT_MODEL=openai/gpt-oss-120b

GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_VISION_MODEL=gemini-2.5-flash
GEMINI_EMBED_MODEL=gemini-embedding-001

LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com

DEMO_CREATOR_EMAIL=creador@content-suite.local
DEMO_CREATOR_PASSWORD=Creador123!
DEMO_APPROVER_A_EMAIL=aprobador.a@content-suite.local
DEMO_APPROVER_A_PASSWORD=AprobadorA123!
DEMO_APPROVER_B_EMAIL=aprobador.b@content-suite.local
DEMO_APPROVER_B_PASSWORD=AprobadorB123!
```

Notas:

- `NEXT_PUBLIC_*` puede usarse en cliente.
- `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY` y `LANGFUSE_SECRET_KEY` son solo servidor.
- Langfuse es opcional. Si sus variables estan vacias, la app igual guarda trazas en `ai_traces`.

## Instalacion

1. Instala dependencias:

```bash
npm install
```

2. Crea un proyecto en Supabase.

3. Ejecuta el SQL:

```bash
supabase/schema.sql
```

Puedes pegarlo en el SQL Editor de Supabase.

4. Configura `.env.local`.

5. Crea usuarios demo:

```bash
npm run seed:demo-users
```

6. Inicia desarrollo:

```bash
npm run dev
```

Abre:

```bash
http://localhost:3000
```

## Usuarios Demo

| Rol | Email | Password |
| --- | --- | --- |
| Creador | `creador@content-suite.local` | `Creador123!` |
| Aprobador A | `aprobador.a@content-suite.local` | `AprobadorA123!` |
| Aprobador B | `aprobador.b@content-suite.local` | `AprobadorB123!` |

Puedes cambiar estas credenciales con las variables `DEMO_*`.

## API

Todas las rutas esperan:

```bash
Authorization: Bearer <supabase_access_token>
```

### Marcas

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/brand/manual` | Lista marcas |
| `POST` | `/api/brand/manual` | Crea marca, manual y embeddings |
| `PATCH` | `/api/brand/manual` | Edita marca, regenera manual y reemplaza embeddings |
| `DELETE` | `/api/brand/manual?id=<brandId>` | Elimina marca y datos asociados |

### Generacion Creativa

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/api/creative/generate` | Genera contenido con RAG y compliance |

Requiere rol `creador`.

### Auditoria Multimodal

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/api/audit/image` | Audita imagen contra manual de marca |

Requiere rol `creador`.

### Gobierno

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/governance/items` | Lista generaciones y auditorias |
| `PATCH` | `/api/governance/items` | Registra revision A/B |

`PATCH` requiere `aprobador_a` o `aprobador_b`.

## Observabilidad

Cada operacion importante registra una traza en `ai_traces`:

- Operacion (`brand_manual`, `creative_generation`, `creative_compliance`, `image_audit`)
- Marca relacionada
- Prompt
- Contexto RAG o manual
- Input
- Output o error
- Modelo usado
- Duracion
- Metadata
- IDs de Langfuse, si aplica

Langfuse se integra desde el backend. Si no configuras Langfuse, la aplicacion sigue funcionando sin dependencia externa.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed:demo-users
```

## Estructura Del Proyecto

```text
app/
  api/
    audit/image/route.ts
    brand/manual/route.ts
    creative/generate/route.ts
    governance/items/route.ts
  layout.tsx
  page.tsx

components/
  audit-panel.tsx
  auth-gate.tsx
  brand-form.tsx
  creative-panel.tsx
  governance-panel.tsx
  result-card.tsx
  ui/

lib/
  auth.ts
  embeddings.ts
  gemini.ts
  groq.ts
  observability.ts
  prompts.ts
  rag.ts
  supabase.ts
  types.ts

scripts/
  seed-demo-users.mjs

supabase/
  schema.sql
```

## Flujo Recomendado Para Demo

1. Inicia sesion como `creador`.
2. Crea una marca, por ejemplo `Alicorp`.
3. Genera el manual y confirma que se guardan chunks en pgvector.
4. Genera una descripcion de producto o guion de video.
5. Sube una imagen para auditoria multimodal.
6. Entra como `aprobador_a` y registra la primera revision.
7. Entra como `aprobador_b` y da la decision final.
8. Revisa `ai_traces` o Langfuse para explicar trazabilidad.

## Consideraciones Tecnicas

- Si cambias el modelo de embeddings, revisa la dimension del vector en Supabase.
- Si ya tenias embeddings de otro proveedor, regenera los manuales para no mezclar espacios vectoriales.
- El borrado de marca limpia datos asociados desde la API para evitar registros huerfanos.
- Las llamadas a proveedores externos ocurren solo en servidor.
- El cliente nunca recibe claves privadas.

## Deploy

La app esta lista para Vercel o cualquier hosting compatible con Next.js.

Checklist de deploy:

- Configurar variables de entorno.
- Ejecutar `supabase/schema.sql` en el proyecto remoto.
- Crear usuarios demo o usuarios reales.
- Validar que `GROQ_API_KEY` y `GEMINI_API_KEY` funcionen.
- Ejecutar `npm run build` antes de publicar.

## Estado Actual

- Hugging Face fue removido.
- Groq queda como motor de texto y decision.
- Gemini queda como motor multimodal y de embeddings.
- El CRUD de marcas esta disponible para todos los usuarios autenticados.
- Creative Engine y Multimodal Audit siguen restringidos al rol `creador`.
- Governance conserva el flujo A/B de aprobacion.
