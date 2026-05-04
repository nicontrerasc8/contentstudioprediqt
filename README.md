# Content Suite

Plataforma Next.js 15 con App Router, TypeScript, TailwindCSS, shadcn/ui, Supabase remoto, pgvector, Groq Cloud y Hugging Face.

## Stack

- Next.js 15
- App Router
- TypeScript
- TailwindCSS
- shadcn/ui
- Supabase Auth con login email/password para todos los usuarios y roles en `profiles`
- Supabase PostgreSQL + pgvector
- Groq Cloud para chat completions, generacion JSON y comparacion contra manual de marca
- Hugging Face Inference Providers para embeddings, captioning, image classification y zero-shot classification
- Langfuse opcional para trazabilidad de prompts, RAG, modelos y latencia
- Backend solo en Route Handlers de Next.js

## Variables de entorno

Crea `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TEXT_MODEL=openai/gpt-oss-120b
HF_TOKEN=
HF_BASE_URL=https://router.huggingface.co/hf-inference/models
HF_EMBED_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
HF_IMAGE_TO_TEXT_MODEL=Salesforce/blip-image-captioning-large
HF_IMAGE_CLASSIFICATION_MODEL=google/vit-base-patch16-224
HF_ZERO_SHOT_MODEL=facebook/bart-large-mnli
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

`SUPABASE_SERVICE_ROLE_KEY` se usa solo en Route Handlers del servidor. No lo importes en componentes cliente.

Langfuse es opcional. No requiere una API key adicional: usa Basic Auth con las credenciales del proyecto (`LANGFUSE_PUBLIC_KEY` como usuario y `LANGFUSE_SECRET_KEY` como password). Si estan vacias, la app no envia trazas externas, pero igual guarda trazabilidad local en `ai_traces`.

## Supabase

1. Crea un proyecto remoto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase/schema.sql`.

El SQL crea:

- `profiles`
- `brands`
- `brand_embeddings`
- `content_generations`
- `image_audits`
- `approval_reviews`
- `ai_traces`
- extension `vector`
- funcion `match_brand_embeddings` para RAG
- RLS habilitado con policies para perfiles, lectura autenticada y creacion por rol

## Usuarios y accesos

Despues de ejecutar `supabase/schema.sql`, crea las cuentas de acceso para validar los 3 roles:

```bash
npm run seed:demo-users
```

Credenciales semilla por defecto:

| Rol | Email | Password |
| --- | --- | --- |
| Creador | `creador@content-suite.local` | `Creador123!` |
| Aprobador A | `aprobador.a@content-suite.local` | `AprobadorA123!` |
| Aprobador B | `aprobador.b@content-suite.local` | `AprobadorB123!` |

Puedes cambiarlas con las variables `DEMO_*` antes de ejecutar el seed.

Para agregar mas usuarios, crealos en Supabase Auth y registra su fila en `public.profiles` con uno de estos roles: `creador`, `aprobador_a` o `aprobador_b`.

## IA en produccion

No se requiere servidor local de modelos.

- `GROQ_API_KEY`: clave de Groq Cloud para manuales, generacion creativa, compliance y auditoria final.
- `HF_TOKEN`: token de Hugging Face con permiso de Inference Providers.
- `HF_EMBED_MODEL`: debe devolver vectores de 768 dimensiones porque `brand_embeddings.embedding` usa `vector(768)`.
- `HF_IMAGE_TO_TEXT_MODEL`: genera la descripcion de la imagen. Por defecto usa BLIP.
- `HF_IMAGE_CLASSIFICATION_MODEL`: detecta etiquetas visuales generales.
- `HF_ZERO_SHOT_MODEL`: evalua senales de estilo como tono profesional, estilo premium o riesgo de incumplimiento.

## Ejecutar

```bash
npm install
npm run seed:demo-users
npm run dev
```

Abre `http://localhost:3000`.

## Flujos

- Brand Manual: genera un manual con `GROQ_TEXT_MODEL`, lo guarda en Supabase, lo divide en chunks y guarda embeddings con `HF_EMBED_MODEL` en pgvector.
- Creative Engine: recupera contexto con `match_brand_embeddings`, genera contenido, ejecuta una validacion posterior de compliance contra el contexto RAG y guarda la generacion como `pendiente`.
- Multimodal Audit: sube una imagen, Hugging Face genera caption, etiquetas y senales zero-shot; luego Groq compara esa evidencia contra el manual de marca y devuelve `check` o `rechazado` con score, issues y recomendacion.
- Login: valida la sesion de cada usuario con Supabase Auth y carga su rol desde `profiles`.
- Governance: lista generaciones y auditorias. `aprobador_a` hace la revision inicial y `aprobador_b` hace la decision final solo si A aprobo.
- Observabilidad: guarda prompts, contexto RAG/manual, modelo, output/error, duracion y IDs de Langfuse en `ai_traces`.

## API Routes

- `GET /api/brand/manual`: lista marcas guardadas para usuarios autenticados.
- `POST /api/brand/manual`: crea manual y embeddings; requiere rol `creador`.
- `POST /api/creative/generate`: genera contenido creativo con RAG; requiere rol `creador`.
- `POST /api/audit/image`: audita imagenes con el modelo vision; requiere rol `creador`.
- `GET /api/governance/items`: lista piezas y auditorias para usuarios autenticados.
- `PATCH /api/governance/items`: registra revision de `aprobador_a` o decision final de `aprobador_b`.

Todas las rutas esperan `Authorization: Bearer <supabase_access_token>`.

## Entregables

- Repositorio GitHub: incluir este codigo, `README.md`, `requirements.txt` y variables de entorno de ejemplo.
- Aplicacion web: desplegar en Vercel o servicio equivalente y pegar la URL publica en la entrega.
- Credenciales: entregar usuarios para los tres roles; puedes usar las cuentas semilla anteriores o las definidas en `DEMO_*`.
- Langfuse: configurar las credenciales del proyecto (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`) solo en el backend/deploy y entregar la URL del proyecto para auditar logs en vivo.
- Presentacion: maximo 6 slides con arquitectura, valor de negocio y limitaciones.
