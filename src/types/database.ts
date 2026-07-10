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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blocked_slots: {
        Row: {
          created_at: string
          end_at: string
          external_id: string | null
          id: string
          reason: string | null
          start_at: string
          type: string
        }
        Insert: {
          created_at?: string
          end_at: string
          external_id?: string | null
          id?: string
          reason?: string | null
          start_at: string
          type: string
        }
        Update: {
          created_at?: string
          end_at?: string
          external_id?: string | null
          id?: string
          reason?: string | null
          start_at?: string
          type?: string
        }
        Relationships: []
      }
      booking_equipment: {
        Row: {
          booking_id: string
          created_at: string
          equipment_id: string
          id: string
          price_at_booking: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          equipment_id: string
          id?: string
          price_at_booking: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          equipment_id?: string
          id?: string
          price_at_booking?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_equipment_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_paid: number
          band_name: string | null
          cancel_token: string
          confirmation_code: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          deposit_amount: number
          end_at: string
          gcal_event_id: string | null
          hold_expires_at: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          reminder_sent: boolean
          reschedule_from: string | null
          service_type_id: string
          source: Database["public"]["Enums"]["booking_source"]
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          band_name?: string | null
          cancel_token?: string
          confirmation_code: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          deposit_amount: number
          end_at: string
          gcal_event_id?: string | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reminder_sent?: boolean
          reschedule_from?: string | null
          service_type_id: string
          source?: Database["public"]["Enums"]["booking_source"]
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          band_name?: string | null
          cancel_token?: string
          confirmation_code?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          deposit_amount?: number
          end_at?: string
          gcal_event_id?: string | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reminder_sent?: boolean
          reschedule_from?: string | null
          service_type_id?: string
          source?: Database["public"]["Enums"]["booking_source"]
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_reschedule_from_fkey"
            columns: ["reschedule_from"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price_per_session: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price_per_session: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price_per_session?: number
          sort_order?: number
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          calendar_id: string
          created_at: string
          encrypted_refresh_token: string
          google_email: string
          id: string
          sync_token: string | null
          updated_at: string
          watch_channel_id: string | null
          watch_expires_at: string | null
          watch_resource_id: string | null
        }
        Insert: {
          calendar_id?: string
          created_at?: string
          encrypted_refresh_token: string
          google_email: string
          id?: string
          sync_token?: string | null
          updated_at?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          encrypted_refresh_token?: string
          google_email?: string
          id?: string
          sync_token?: string | null
          updated_at?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          kind: string
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          kind: string
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          kind?: string
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          active: boolean
          created_at: string
          deposit_pct: number
          id: string
          name: string
          rate_per_hour: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          deposit_pct?: number
          id?: string
          name: string
          rate_per_hour: number
        }
        Update: {
          active?: boolean
          created_at?: string
          deposit_pct?: number
          id?: string
          name?: string
          rate_per_hour?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          bank_details: string | null
          buffer_minutes: number
          default_deposit_pct: number
          gcash_qr_url: string | null
          hold_window_minutes: number
          id: string
          min_booking_minutes: number
          operating_close: string
          operating_open: string
          reminder_enabled: boolean
        }
        Insert: {
          bank_details?: string | null
          buffer_minutes?: number
          default_deposit_pct?: number
          gcash_qr_url?: string | null
          hold_window_minutes?: number
          id?: string
          min_booking_minutes?: number
          operating_close?: string
          operating_open?: string
          reminder_enabled?: boolean
        }
        Update: {
          bank_details?: string | null
          buffer_minutes?: number
          default_deposit_pct?: number
          gcash_qr_url?: string | null
          hold_window_minutes?: number
          id?: string
          min_booking_minutes?: number
          operating_close?: string
          operating_open?: string
          reminder_enabled?: boolean
        }
        Relationships: []
      }
      special_hours: {
        Row: {
          close_time: string | null
          closed: boolean
          date: string
          id: string
          open_time: string | null
        }
        Insert: {
          close_time?: string | null
          closed?: boolean
          date: string
          id?: string
          open_time?: string | null
        }
        Update: {
          close_time?: string | null
          closed?: boolean
          date?: string
          id?: string
          open_time?: string | null
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
      booking_source: "online" | "onsite" | "walk_in"
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      payment_method_type: "full" | "deposit" | "none"
      payment_status: "pending" | "paid" | "failed" | "refunded"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_source: ["online", "onsite", "walk_in"],
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      payment_method_type: ["full", "deposit", "none"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
