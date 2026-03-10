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
      conversation_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          role: string
          step_number: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          role: string
          step_number?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          role?: string
          step_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_records: {
        Row: {
          assigned_actions: Json | null
          closed_at: string | null
          created_at: string
          customer_id: string
          customer_segment: string | null
          email_address: string
          engagement_score: number | null
          follow_up_sequence: string | null
          full_name: string
          id: string
          initial_contact_date: string | null
          is_won: boolean | null
          keyword_source: string | null
          last_interaction_date: string | null
          lead_id: string
          lead_source: string | null
          lead_stage: string
          mailing_address: string | null
          marketing_campaign_id: string | null
          marketing_opt_in_status: boolean | null
          notes: string | null
          persona_match: string | null
          phone_number: string | null
          preferred_contact_method: string | null
          product_ordered: string | null
          qualification_score: number | null
          quote_issued_date: string | null
          quote_value: number | null
          referral_source: string | null
          response_time_hours: number | null
          routing_decision: string | null
          sales_briefing: string | null
          sales_rep: string | null
          score_breakdown: Json | null
          updated_at: string
          weak_categories: Json | null
        }
        Insert: {
          assigned_actions?: Json | null
          closed_at?: string | null
          created_at?: string
          customer_id: string
          customer_segment?: string | null
          email_address: string
          engagement_score?: number | null
          follow_up_sequence?: string | null
          full_name: string
          id?: string
          initial_contact_date?: string | null
          is_won?: boolean | null
          keyword_source?: string | null
          last_interaction_date?: string | null
          lead_id: string
          lead_source?: string | null
          lead_stage?: string
          mailing_address?: string | null
          marketing_campaign_id?: string | null
          marketing_opt_in_status?: boolean | null
          notes?: string | null
          persona_match?: string | null
          phone_number?: string | null
          preferred_contact_method?: string | null
          product_ordered?: string | null
          qualification_score?: number | null
          quote_issued_date?: string | null
          quote_value?: number | null
          referral_source?: string | null
          response_time_hours?: number | null
          routing_decision?: string | null
          sales_briefing?: string | null
          sales_rep?: string | null
          score_breakdown?: Json | null
          updated_at?: string
          weak_categories?: Json | null
        }
        Update: {
          assigned_actions?: Json | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_segment?: string | null
          email_address?: string
          engagement_score?: number | null
          follow_up_sequence?: string | null
          full_name?: string
          id?: string
          initial_contact_date?: string | null
          is_won?: boolean | null
          keyword_source?: string | null
          last_interaction_date?: string | null
          lead_id?: string
          lead_source?: string | null
          lead_stage?: string
          mailing_address?: string | null
          marketing_campaign_id?: string | null
          marketing_opt_in_status?: boolean | null
          notes?: string | null
          persona_match?: string | null
          phone_number?: string | null
          preferred_contact_method?: string | null
          product_ordered?: string | null
          qualification_score?: number | null
          quote_issued_date?: string | null
          quote_value?: number | null
          referral_source?: string | null
          response_time_hours?: number | null
          routing_decision?: string | null
          sales_briefing?: string | null
          sales_rep?: string | null
          score_breakdown?: Json | null
          updated_at?: string
          weak_categories?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          lead_id: string
          message_number: number
          personalization_tags: Json | null
          responded_at: string | null
          scheduled_at: string | null
          sent_at: string | null
          sequence_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          lead_id: string
          message_number: number
          personalization_tags?: Json | null
          responded_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          message_number?: number
          personalization_tags?: Json | null
          responded_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_messages_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          created_at: string
          crm_record_id: string | null
          current_message_number: number | null
          edit_before_sending: boolean | null
          id: string
          lead_id: string
          sequence_type: string
          status: string
          total_messages: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crm_record_id?: string | null
          current_message_number?: number | null
          edit_before_sending?: boolean | null
          id?: string
          lead_id: string
          sequence_type: string
          status?: string
          total_messages?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crm_record_id?: string | null
          current_message_number?: number | null
          edit_before_sending?: boolean | null
          id?: string
          lead_id?: string
          sequence_type?: string
          status?: string
          total_messages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequences_crm_record_id_fkey"
            columns: ["crm_record_id"]
            isOneToOne: false
            referencedRelation: "crm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
          campaign_id: string | null
          conversation_data: Json | null
          conversation_status: string | null
          created_at: string
          customer_segment:
            | Database["public"]["Enums"]["customer_segment"]
            | null
          email: string
          engagement_score: number | null
          fit_level: Database["public"]["Enums"]["fit_level"] | null
          full_name: string
          id: string
          inquiry_summary: string | null
          keyword_source: string | null
          lead_stage: Database["public"]["Enums"]["lead_stage"]
          lead_status: Database["public"]["Enums"]["lead_status"]
          location: string | null
          mailing_address: string | null
          message: string
          missing_fields: Json | null
          persona_match: string | null
          phone: string | null
          preferred_contact:
            | Database["public"]["Enums"]["preferred_contact"]
            | null
          qualification_data: Json | null
          qualification_score: number | null
          qualified_at: string | null
          referral_source: string | null
          response_time_hours: number | null
          routed_at: string | null
          routing_action: string | null
          routing_reason: string | null
          sent_to_conversation_agent: boolean
          source: Database["public"]["Enums"]["lead_source"] | null
          timeline: Database["public"]["Enums"]["lead_timeline"] | null
          updated_at: string
        }
        Insert: {
          budget?: Database["public"]["Enums"]["budget_range"] | null
          campaign_id?: string | null
          conversation_data?: Json | null
          conversation_status?: string | null
          created_at?: string
          customer_segment?:
            | Database["public"]["Enums"]["customer_segment"]
            | null
          email: string
          engagement_score?: number | null
          fit_level?: Database["public"]["Enums"]["fit_level"] | null
          full_name: string
          id?: string
          inquiry_summary?: string | null
          keyword_source?: string | null
          lead_stage?: Database["public"]["Enums"]["lead_stage"]
          lead_status?: Database["public"]["Enums"]["lead_status"]
          location?: string | null
          mailing_address?: string | null
          message: string
          missing_fields?: Json | null
          persona_match?: string | null
          phone?: string | null
          preferred_contact?:
            | Database["public"]["Enums"]["preferred_contact"]
            | null
          qualification_data?: Json | null
          qualification_score?: number | null
          qualified_at?: string | null
          referral_source?: string | null
          response_time_hours?: number | null
          routed_at?: string | null
          routing_action?: string | null
          routing_reason?: string | null
          sent_to_conversation_agent?: boolean
          source?: Database["public"]["Enums"]["lead_source"] | null
          timeline?: Database["public"]["Enums"]["lead_timeline"] | null
          updated_at?: string
        }
        Update: {
          budget?: Database["public"]["Enums"]["budget_range"] | null
          campaign_id?: string | null
          conversation_data?: Json | null
          conversation_status?: string | null
          created_at?: string
          customer_segment?:
            | Database["public"]["Enums"]["customer_segment"]
            | null
          email?: string
          engagement_score?: number | null
          fit_level?: Database["public"]["Enums"]["fit_level"] | null
          full_name?: string
          id?: string
          inquiry_summary?: string | null
          keyword_source?: string | null
          lead_stage?: Database["public"]["Enums"]["lead_stage"]
          lead_status?: Database["public"]["Enums"]["lead_status"]
          location?: string | null
          mailing_address?: string | null
          message?: string
          missing_fields?: Json | null
          persona_match?: string | null
          phone?: string | null
          preferred_contact?:
            | Database["public"]["Enums"]["preferred_contact"]
            | null
          qualification_data?: Json | null
          qualification_score?: number | null
          qualified_at?: string | null
          referral_source?: string | null
          response_time_hours?: number | null
          routed_at?: string | null
          routing_action?: string | null
          routing_reason?: string | null
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
      customer_segment: "new_lead" | "high_value" | "warm" | "dormant"
      fit_level: "high_fit" | "medium_fit" | "low_fit"
      lead_source: "google" | "social_media" | "word_of_mouth" | "other"
      lead_stage:
        | "inquiry"
        | "qualified"
        | "quoted"
        | "sold"
        | "installed"
        | "retention"
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
      preferred_contact: "email" | "phone" | "sms" | "any"
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
      customer_segment: ["new_lead", "high_value", "warm", "dormant"],
      fit_level: ["high_fit", "medium_fit", "low_fit"],
      lead_source: ["google", "social_media", "word_of_mouth", "other"],
      lead_stage: [
        "inquiry",
        "qualified",
        "quoted",
        "sold",
        "installed",
        "retention",
      ],
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
      preferred_contact: ["email", "phone", "sms", "any"],
    },
  },
} as const
