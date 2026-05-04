export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const creativeContentTypes = [
  "descripcion de producto",
  "guion de video",
  "prompt de imagen",
] as const;

export type CreativeContentType = (typeof creativeContentTypes)[number];
export type AppRole = "creador" | "aprobador_a" | "aprobador_b";
export type ApprovalStatus = "pendiente" | "aprobado" | "rechazado";
export type ComplianceStatus = "pendiente" | "check" | "rechazado";

export type Profile = {
  user_id: string;
  email: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string;
  created_by: string | null;
  name: string;
  product: string;
  tone: string;
  audience: string;
  restrictions: string | null;
  manual_text: string;
  created_at: string;
};

export type BrandSummary = Omit<Brand, "manual_text"> & {
  manual_text?: string;
};

export type BrandManualRequest = {
  name: string;
  product: string;
  tone: string;
  audience: string;
  restrictions?: string;
};

export type BrandManualResponse = {
  brand: Brand;
  chunks: number;
};

export type CreativeGenerateRequest = {
  brandId: string;
  type: CreativeContentType;
};

export type CreativeGeneration = {
  id: string;
  brand_id: string;
  created_by: string | null;
  type: string;
  output: string;
  compliance_status: ComplianceStatus;
  compliance_issues: Json;
  approval_status: ApprovalStatus;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type CreativeGenerateResponse = {
  generation: CreativeGeneration;
  output: string;
  context: string;
  compliance: CreativeComplianceResult;
};

export type ImageAuditStatus = "check" | "rechazado";

export type ImageAuditResult = {
  status: ImageAuditStatus;
  score: number;
  issues: string[];
  recommendation: string;
};

export type ImageAudit = {
  id: string;
  brand_id: string;
  created_by: string | null;
  image_name: string;
  status: ImageAuditStatus;
  score: number;
  issues: Json;
  recommendation: string;
  approval_status: ApprovalStatus;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ImageAuditResponse = {
  audit: ImageAudit;
  result: ImageAuditResult;
};

export type RagMatch = {
  id: string;
  brand_id: string;
  chunk: string;
  similarity: number;
};

export type CreativeComplianceResult = {
  status: ComplianceStatus;
  issues: string[];
  revisedOutput?: string;
};

export type AiTraceOperation =
  | "brand_manual"
  | "creative_generation"
  | "creative_compliance"
  | "image_audit";

export type AiTrace = {
  id: string;
  operation: AiTraceOperation;
  brand_id: string | null;
  item_type: string | null;
  item_id: string | null;
  model: string;
  prompt: string;
  rag_context: string | null;
  input: Json;
  output: string | null;
  error: string | null;
  duration_ms: number;
  langfuse_enabled: boolean;
  langfuse_trace_id: string | null;
  langfuse_observation_id: string | null;
  metadata: Json;
  created_at: string;
};

export type GovernanceItemType = "content" | "image_audit";

export type GovernanceRole = AppRole;

export type ApprovalReview = {
  id: string;
  item_type: GovernanceItemType;
  item_id: string;
  reviewer_id: string | null;
  reviewer_role: Extract<AppRole, "aprobador_a" | "aprobador_b">;
  decision: ApprovalStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernanceItem = {
  id: string;
  itemType: GovernanceItemType;
  brandId: string;
  brandName: string;
  title: string;
  body: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewAStatus: ApprovalStatus;
  reviewANote: string | null;
  reviewABy: string | null;
  reviewAAt: string | null;
  reviewBStatus: ApprovalStatus;
  reviewBNote: string | null;
  reviewBBy: string | null;
  reviewBAt: string | null;
  aiStatus?: ImageAuditStatus | ComplianceStatus;
  score?: number;
  issues?: string[];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          user_id: string;
          email: string;
          full_name: string;
          role: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      brands: {
        Row: Brand;
        Insert: {
          id?: string;
          created_by?: string | null;
          name: string;
          product: string;
          tone: string;
          audience: string;
          restrictions?: string | null;
          manual_text: string;
          created_at?: string;
        };
        Update: Partial<Brand>;
        Relationships: [];
      };
      brand_embeddings: {
        Row: {
          id: string;
          brand_id: string;
          chunk: string;
          embedding: number[];
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          chunk: string;
          embedding: number[];
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          chunk?: string;
          embedding?: number[];
          created_at?: string;
        };
        Relationships: [];
      };
      content_generations: {
        Row: CreativeGeneration;
        Insert: {
          id?: string;
          brand_id: string;
          created_by?: string | null;
          type: string;
          output: string;
          compliance_status?: ComplianceStatus;
          compliance_issues?: Json;
          approval_status?: ApprovalStatus;
          reviewed_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<CreativeGeneration>;
        Relationships: [];
      };
      image_audits: {
        Row: ImageAudit;
        Insert: {
          id?: string;
          brand_id: string;
          created_by?: string | null;
          image_name: string;
          status: ImageAuditStatus;
          score: number;
          issues: Json;
          recommendation: string;
          approval_status?: ApprovalStatus;
          reviewed_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<ImageAudit>;
        Relationships: [];
      };
      approval_reviews: {
        Row: ApprovalReview;
        Insert: {
          id?: string;
          item_type: GovernanceItemType;
          item_id: string;
          reviewer_id?: string | null;
          reviewer_role: Extract<AppRole, "aprobador_a" | "aprobador_b">;
          decision: ApprovalStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ApprovalReview>;
        Relationships: [];
      };
      ai_traces: {
        Row: AiTrace;
        Insert: {
          id?: string;
          operation: AiTraceOperation;
          brand_id?: string | null;
          item_type?: string | null;
          item_id?: string | null;
          model: string;
          prompt: string;
          rag_context?: string | null;
          input?: Json;
          output?: string | null;
          error?: string | null;
          duration_ms: number;
          langfuse_enabled?: boolean;
          langfuse_trace_id?: string | null;
          langfuse_observation_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<AiTrace>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_brand_embeddings: {
        Args: {
          query_embedding: number[];
          match_brand_id: string;
          match_count?: number;
        };
        Returns: RagMatch[];
      };
    };
    Enums: {
      app_role: AppRole;
      approval_decision: ApprovalStatus;
      governance_item_type: GovernanceItemType;
    };
    CompositeTypes: Record<string, never>;
  };
};
