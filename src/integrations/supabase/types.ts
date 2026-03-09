export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          content_id: string | null
          created_at: string
          details: Json | null
          id: string
          request_id: string | null
        }
        Insert: {
          action: string
          content_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          content_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "generated_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "content_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      content_requests: {
        Row: {
          additional_context: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          prompt: string
          status: Database["public"]["Enums"]["content_status"]
          target_audience: string | null
          updated_at: string
        }
        Insert: {
          additional_context?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          prompt: string
          status?: Database["public"]["Enums"]["content_status"]
          target_audience?: string | null
          updated_at?: string
        }
        Update: {
          additional_context?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          prompt?: string
          status?: Database["public"]["Enums"]["content_status"]
          target_audience?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      generated_content: {
        Row: {
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          image_url: string | null
          is_approved: boolean
          posted_at: string | null
          request_id: string
          target_platform: Database["public"]["Enums"]["platform_type"] | null
          text_content: string | null
          updated_at: string
          version: number
        }
        Insert: {
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean
          posted_at?: string | null
          request_id: string
          target_platform?: Database["public"]["Enums"]["platform_type"] | null
          text_content?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean
          posted_at?: string | null
          request_id?: string
          target_platform?: Database["public"]["Enums"]["platform_type"] | null
          text_content?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "content_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          budget: Database["public"]["Enums"]["budget_range"] | null
          created_at: string
          email: string
          full_name: string
          id: string
          inquiry_summary: string | null
          lead_status: Database["public"]["Enums"]["lead_status"]
          location: string | null
          message: string
          missing_fields: Json | null
          phone: string | null
          sent_to_conversation_agent: boolean
          source: Database["public"]["Enums"]["lead_source"] | null
          timeline: Database["public"]["Enums"]["lead_timeline"] | null
          updated_at: string
        }
        Insert: {
          budget?: Database["public"]["Enums"]["budget_range"] | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          inquiry_summary?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          location?: string | null
          message: string
          missing_fields?: Json | null
          phone?: string | null
          sent_to_conversation_agent?: boolean
          source?: Database["public"]["Enums"]["lead_source"] | null
          timeline?: Database["public"]["Enums"]["lead_timeline"] | null
          updated_at?: string
        }
        Update: {
          budget?: Database["public"]["Enums"]["budget_range"] | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          inquiry_summary?: string | null
          lead_status?: Database["public"]["Enums"]["lead_status"]
          location?: string | null
          message?: string
          missing_fields?: Json | null
          phone?: string | null
          sent_to_conversation_agent?: boolean
          source?: Database["public"]["Enums"]["lead_source"] | null
          timeline?: Database["public"]["Enums"]["lead_timeline"] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      budget_range: "under_30k" | "30k_50k" | "50k_80k" | "80k_plus"
      content_status:
        | "draft"
        | "generating"
        | "review"
        | "approved"
        | "posted"
        | "rejected"
      content_type:
        | "social_post"
        | "blog_article"
        | "ad_copy"
        | "caption"
        | "image"
      lead_source: "google" | "social_media" | "word_of_mouth" | "other"
      lead_status: "complete" | "incomplete"
      lead_timeline:
        | "asap"
        | "within_3_months"
        | "3_6_months"
        | "6_12_months"
        | "12_plus_months"
      platform_type:
        | "linkedin"
        | "instagram"
        | "x"
        | "facebook"
        | "website"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      budget_range: ["under_30k", "30k_50k", "50k_80k", "80k_plus"],
      content_status: [
        "draft",
        "generating",
        "review",
        "approved",
        "posted",
        "rejected",
      ],
      content_type: [
        "social_post",
        "blog_article",
        "ad_copy",
        "caption",
        "image",
      ],
      lead_source: ["google", "social_media", "word_of_mouth", "other"],
      lead_status: ["complete", "incomplete"],
      lead_timeline: [
        "asap",
        "within_3_months",
        "3_6_months",
        "6_12_months",
        "12_plus_months",
      ],
      platform_type: [
        "linkedin",
        "instagram",
        "x",
        "facebook",
        "website",
        "other",
      ],
    },
  },
} as const
