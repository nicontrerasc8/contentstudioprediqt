# Content Suite

Content Suite es una plataforma web para crear, vectorizar, generar y gobernar contenido de marca con IA. El sistema combina manuales de marca, RAG con pgvector, generacion creativa, auditoria multimodal y aprobacion por roles en un solo flujo operativo.



## Resumen Ejecutivo

Content Suite resuelve un problema comun en equipos de marketing: generar piezas rapido sin perder consistencia, trazabilidad ni control de aprobacion.

El usuario crea una marca, la app genera un manual con Groq, vectoriza ese manual con Gemini Embeddings, recupera contexto por RAG para crear contenido y permite auditar imagenes usando Gemini Vision + Groq. Luego, las piezas pasan por un flujo de governance con Aprobador A y Aprobador B.

## Funcionalidades

| Modulo | Que permite hacer |
| --- | --- |
| CRUD de marcas | Crear, editar, regenerar y eliminar marcas con su manual vectorizado |
| Brand Manual | Generar una guia de marca completa y accionable |
| RAG | Recuperar chunks relevantes del manual usando pgvector |
| Creative Engine | Generar descripciones de producto, guiones de video y prompts de imagen |
| Compliance IA | Validar si el contenido generado respeta el contexto de marca |
| Multimodal Audit | Auditar imagenes contra el manual de marca |
| Governance | Revisar y aprobar piezas con flujo A/B |
| Observabilidad | Ver en la app la tabla `ai_traces` con prompts, outputs, errores, modelos y latencia |
| Langfuse | Auditar logs en vivo de forma opcional |

## Stack Tecnico

| Capa | Tecnologia |
| --- | --- |
| Frontend | Next.js 15, App Router, React 19, TypeScript |
| UI | TailwindCSS, shadcn/ui local, lucide-react |
| Backend | Route Handlers de Next.js |
| Auth | Supabase Auth con email/password |
| Base de datos | Supabase Postgres |
| Vector search | pgvector con `vector(768)` |
| Texto IA | Groq Cloud |
| Embeddings | Gemini `gemini-embedding-001` |
| Vision | Gemini `gemini-2.5-flash-lite` |
| Observabilidad | Tabla `ai_traces` |

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
  |     +-- Supabase guarda marca y chunks vectorizados
  |
  +-- Creative Engine
  |     +-- Gemini embeddea la consulta
  |     +-- pgvector recupera contexto del manual
  |     +-- Groq genera contenido
  |     +-- Groq valida compliance
  |
  +-- Multimodal Audit
  |     +-- Gemini describe la imagen
  |     +-- Gemini extrae etiquetas y senales visuales
  |     +-- Groq decide si cumple el manual
  |
  +-- Governance
        +-- Aprobador A revisa primero
        +-- Aprobador B da la decision final
```

## Flujo Principal

1. El usuario inicia sesion con Supabase Auth.
2. Crea una marca desde el CRUD.
3. Groq genera el manual de marca.
4. La app divide el manual en chunks.
5. Gemini genera embeddings de 768 dimensiones.
6. Supabase guarda los embeddings en pgvector.
7. El usuario genera contenido creativo con contexto RAG.
8. La app valida compliance con IA.
9. El usuario audita imagenes contra el manual.
10. Aprobador A y Aprobador B revisan las piezas en Governance.

## Modulos

### CRUD de Marcas

Disponible para todos los usuarios autenticados.

Permite:

- Crear marcas.
- Editar datos de marca.
- Regenerar el manual al guardar cambios.
- Reemplazar embeddings antiguos por embeddings nuevos.
- Eliminar marca y datos asociados.
- Consultar marcas desde Creative Engine y Multimodal Audit.

Campos:

- Marca
- Producto
- Tono
- Publico objetivo
- Restricciones

Al crear o editar una marca, el sistema regenera el manual y actualiza su base vectorial.

### Brand Manual

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

Este manual se convierte en la fuente de verdad para RAG, generacion creativa y auditoria multimodal.

### Creative Engine

Disponible para el rol `creador`.

Tipos de contenido:

- `descripcion de producto`
- `guion de video`
- `prompt de imagen`

Proceso:

1. Selecciona una marca.
2. Recupera contexto con `match_brand_embeddings`.
3. Genera contenido con Groq.
4. Valida compliance con Groq.
5. Guarda la pieza como pendiente para governance.

### Multimodal Audit

Disponible para el rol `creador`.

Proceso:

1. Sube una imagen.
2. Gemini genera una descripcion objetiva.
3. Gemini extrae etiquetas visuales.
4. Gemini estima senales de estilo y riesgo.
5. Groq compara esa evidencia contra el manual.
6. La app guarda el resultado para revision.

Resultado:

```json
{
  "status": "check | rechazado",
  "score": 0,
  "issues": [],
  "recommendation": "..."
}
```

### Governance

El panel de gobierno muestra generaciones creativas y auditorias multimodales.

| Rol | Permisos |
| --- | --- |
| `creador` | Crea marcas, genera contenido y audita imagenes |
| `aprobador_a` | Realiza la primera revision |
| `aprobador_b` | Da la decision final si Aprobador A aprobo |

Regla clave:

```text
Aprobador B no puede aprobar ni rechazar una pieza si Aprobador A no la aprobo primero.
```

### AI Traces

Disponible para usuarios autenticados.

La seccion `AI Traces` permite revisar desde la app las ultimas trazas guardadas en `ai_traces`.

Incluye:

- Operacion (`brand_manual`, `creative_generation`, `creative_compliance`, `image_audit`).
- Modelo usado.
- Duracion en milisegundos.
- Prompt enviado.
- Input estructurado.
- Output recibido.
- Contexto RAG o manual usado.
- Errores, si ocurrieron.
- Metadata y referencias Langfuse, si existen.

Tambien permite filtrar por tipo de operacion y expandir cada registro para auditar el detalle.

## Modelos de IA

### Groq

Se usa para:

- Manuales de marca.
- Generacion creativa.
- Compliance textual.
- Decision final de auditoria contra el manual.

Variables:

```bash
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TEXT_MODEL=openai/gpt-oss-120b
```

### Gemini / Google AI Studio

Se usa para:

- Embeddings del manual.
- Analisis multimodal de imagenes.
- Descripcion visual.
- Etiquetas visuales.
- Senales de estilo y riesgo.

Variables:

```bash
GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_VISION_MODEL=gemini-2.5-flash-lite
GEMINI_EMBED_MODEL=gemini-embedding-001
```

La app usa `outputDimensionality: 768` para mantener compatibilidad con `brand_embeddings.embedding vector(768)`.

## Supabase

El esquema principal esta en:

```bash
supabase/schema.sql
```

Tablas:

| Tabla | Uso |
| --- | --- |
| `profiles` | Usuarios, nombres y roles |
| `brands` | Marcas y manuales generados |
| `brand_embeddings` | Chunks vectorizados del manual |
| `content_generations` | Contenido generado |
| `image_audits` | Auditorias multimodales |
| `approval_reviews` | Revisiones por aprobadores |
| `ai_traces` | Trazabilidad local de IA |

Funciones:

- `match_brand_embeddings`: recuperacion semantica con pgvector.
- `current_app_role`: obtiene el rol del usuario autenticado.
- `touch_updated_at`: actualiza timestamps.

Seguridad:

- RLS esta habilitado.
- La app no requiere `SUPABASE_SERVICE_ROLE_KEY` en produccion.
- Los Route Handlers usan anon key + bearer token del usuario.
- Las claves privadas de IA se ejecutan solo en servidor.

## Variables de Entorno

Variables recomendadas para produccion:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TEXT_MODEL=openai/gpt-oss-120b

GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_VISION_MODEL=gemini-2.5-flash-lite
GEMINI_EMBED_MODEL=gemini-embedding-001

LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Variables opcionales para crear usuarios demo con el script local:

```bash
DEMO_CREATOR_EMAIL=creador@content-suite.local
DEMO_CREATOR_PASSWORD=Creador123!
DEMO_APPROVER_A_EMAIL=aprobador.a@content-suite.local
DEMO_APPROVER_A_PASSWORD=AprobadorA123!
DEMO_APPROVER_B_EMAIL=aprobador.b@content-suite.local
DEMO_APPROVER_B_PASSWORD=AprobadorB123!
```

Nota: `npm run seed:demo-users` usa la Admin API de Supabase y por eso puede requerir `SUPABASE_SERVICE_ROLE_KEY` solo para ese script. La aplicacion desplegada no la necesita.

## Instalacion Local

1. Instalar dependencias:

```bash
npm install
```

2. Crear proyecto en Supabase.

3. Ejecutar el SQL:

```text
supabase/schema.sql
```

Pegalo en el SQL Editor de Supabase.

4. Configurar `.env.local`.

5. Crear usuarios demo, si se desea:

```bash
npm run seed:demo-users
```

6. Iniciar la app:

```bash
npm run dev
```

URL local:

```bash
http://localhost:3000
```

## Credenciales Demo

Creador  
Email: `creador@content-suite.local`  
Contrasena: `Creador123!`

Aprobador A  
Email: `aprobador.a@content-suite.local`  
Contrasena: `AprobadorA123!`

Aprobador B  
Email: `aprobador.b@content-suite.local`  
Contrasena: `AprobadorB123!`

## API

Todas las rutas esperan:

```http
Authorization: Bearer <supabase_access_token>
```

### Marcas

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/brand/manual` | Lista marcas |
| `POST` | `/api/brand/manual` | Crea marca, manual y embeddings |
| `PATCH` | `/api/brand/manual` | Edita marca, regenera manual y reemplaza embeddings |
| `DELETE` | `/api/brand/manual?id=<brandId>` | Elimina marca y datos asociados |

### Creative Engine

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/api/creative/generate` | Genera contenido con RAG y compliance |

Requiere rol `creador`.

### Multimodal Audit

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/api/audit/image` | Audita imagen contra el manual de marca |

Requiere rol `creador`.

### Governance

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/governance/items` | Lista generaciones y auditorias |
| `PATCH` | `/api/governance/items` | Registra revision A/B |

`PATCH` requiere rol `aprobador_a` o `aprobador_b`.

### Observabilidad

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/observability/traces` | Lista las ultimas trazas de IA |

Parametros opcionales:

- `limit`: cantidad de trazas, maximo 100.
- `operation`: filtra por `brand_manual`, `creative_generation`, `creative_compliance` o `image_audit`.

## Observabilidad

Cada operacion importante genera una traza en `ai_traces`:

- Operacion.
- Marca relacionada.
- Prompt.
- Contexto RAG o manual.
- Input.
- Output.
- Error, si existe.
- Modelo usado.
- Duracion.
- Metadata.
- IDs de Langfuse, si aplica.

Para Langfuse Cloud:

```bash
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Para entregar acceso a logs en vivo, comparte la URL completa del proyecto en Langfuse, por ejemplo:

```text
https://cloud.langfuse.com/project/tu-project-id
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed:demo-users
```

## Estructura del Proyecto

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
  missing-access-governance.sql
```

## Demo Recomendada

1. Inicia sesion como Creador.
2. Crea una marca, por ejemplo `Alicorp`.
3. Revisa que el manual se genere y se guarden chunks en pgvector.
4. Genera una descripcion de producto.
5. Audita una imagen.
6. Entra como Aprobador A y registra la primera revision.
7. Entra como Aprobador B y da la decision final.
8. Muestra `ai_traces` o Langfuse para explicar trazabilidad.

## Deploy

Checklist:

- Crear proyecto Supabase.
- Ejecutar `supabase/schema.sql`.
- Configurar variables de entorno.
- Configurar Groq.
- Configurar Google AI Studio.
- Configurar Langfuse si se requiere auditoria externa.
- Crear usuarios demo o usuarios reales.
- Ejecutar `npm run build`.
- Desplegar en Vercel o hosting compatible con Next.js.

## Estado Final

- Sin Hugging Face.
- Sin service role key en produccion.
- Groq para texto y decisiones.
- Gemini para embeddings y multimodal.
- Supabase Auth + RLS para permisos.
- CRUD de marcas para todos los usuarios autenticados.
- Creative Engine y Multimodal Audit reservados a `creador`.
- Governance con aprobacion A/B.
- Trazabilidad local y Langfuse opcional.
