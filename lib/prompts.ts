import type {
  Brand,
  BrandManualRequest,
  CreativeContentType,
} from "@/lib/types";
import type { ImageLabel, ZeroShotSignal } from "@/lib/huggingface";

export function buildBrandManualPrompt(input: BrandManualRequest) {
  return `Eres un estratega senior de marca y contenido.

Crea un manual de marca completo, accionable y coherente para:

Nombre de marca: ${input.name}
Producto/servicio: ${input.product}
Tono: ${input.tone}
Publico objetivo: ${input.audience}
Restricciones: ${input.restrictions || "Sin restricciones adicionales"}

El manual debe incluir:
1. Esencia de marca
2. Propuesta de valor
3. Personalidad y voz
4. Mensajes clave
5. Reglas de escritura
6. Reglas visuales descriptivas
7. Palabras permitidas y palabras a evitar
8. Ejemplos de contenido correcto e incorrecto
9. Checklist de aprobacion

Responde en espanol, con secciones claras y contenido listo para usar.`;
}

export function buildCreativePrompt(input: {
  brand: Pick<Brand, "name" | "product" | "tone" | "audience">;
  type: CreativeContentType;
  context: string;
}) {
  return `Eres un director creativo que trabaja con una guia de marca recuperada por RAG.

Marca: ${input.brand.name}
Producto/servicio: ${input.brand.product}
Tono base: ${input.brand.tone}
Publico objetivo: ${input.brand.audience}
Tipo de contenido solicitado: ${input.type}

Contexto de marca recuperado:
${input.context}

Genera el contenido solicitado respetando estrictamente el contexto. Si el tipo es "prompt de imagen", produce un prompt claro para un modelo generativo de imagen. Si es "guion de video", estructura por escenas. Si es "descripcion de producto", entrega una version lista para publicar.`;
}

export function buildCreativeCompliancePrompt(input: {
  type: CreativeContentType;
  context: string;
  output: string;
}) {
  return `Eres un auditor de cumplimiento de marca.

Evalua si el contenido generado respeta estrictamente el contexto de marca recuperado por RAG.

Tipo de contenido: ${input.type}

Contexto de marca recuperado:
${input.context}

Contenido generado:
${input.output}

Devuelve solo JSON valido con esta forma exacta:
{
  "status": "check" | "rechazado",
  "issues": string[],
  "revisedOutput": string
}

Reglas:
- status debe ser "check" solo si el contenido cumple el manual.
- Si status es "rechazado", issues debe listar las reglas incumplidas.
- Si status es "rechazado", revisedOutput debe traer una version corregida lista para publicar.
- Si status es "check", issues debe ser [] y revisedOutput debe repetir el contenido aprobado.`;
}

export function buildImageAuditPrompt(input: {
  brandName: string;
  manualText: string;
  imageName: string;
  imageDescription: string;
  imageLabels: ImageLabel[];
  visualSignals: ZeroShotSignal[];
}) {
  const labels = input.imageLabels.length
    ? input.imageLabels
        .map((label) => `- ${label.label}: ${label.score.toFixed(3)}`)
        .join("\n")
    : "- Sin etiquetas disponibles";
  const signals = input.visualSignals.length
    ? input.visualSignals
        .map((signal) => `- ${signal.label}: ${signal.score.toFixed(3)}`)
        .join("\n")
    : "- Sin senales zero-shot disponibles";

  return `Eres un auditor de marca visual. Evalua una imagen contra este manual de marca usando solo la descripcion y senales visuales entregadas.

Marca: ${input.brandName}
Imagen: ${input.imageName}

Descripcion de la imagen generada por vision/captioning:
${input.imageDescription}

Etiquetas visuales detectadas:
${labels}

Senales zero-shot sobre estilo/tono:
${signals}

Manual de marca:
${input.manualText}

Devuelve solo JSON valido con esta forma exacta:
{
  "status": "check" | "rechazado",
  "score": number,
  "issues": string[],
  "recommendation": string
}

Reglas:
- status debe ser "check" si la imagen puede aprobarse o "rechazado" si incumple.
- score debe estar entre 0 y 100.
- issues debe listar problemas concretos. Usa [] si no hay problemas.
- recommendation debe ser una recomendacion accionable y breve.
- No inventes elementos visuales que no aparezcan en la descripcion, etiquetas o senales.`;
}
