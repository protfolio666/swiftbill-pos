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
      kot_orders: {
        Row: {
          assigned_chef_id: string | null
          completed_at: string | null
          created_at: string
          customer_name: string | null
          delay_reason: string | null
          delay_remarks: string | null
          id: string
          items: Json
          order_id: string
          owner_id: string
          prep_time_minutes: number | null
          served_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["kot_order_status"] | null
          table_number: number | null
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          assigned_chef_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          delay_reason?: string | null
          delay_remarks?: string | null
          id?: string
          items: Json
          order_id: string
          owner_id: string
          prep_time_minutes?: number | null
          served_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["kot_order_status"] | null
          table_number?: number | null
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          assigned_chef_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          delay_reason?: string | null
          delay_remarks?: string | null
          id?: string
          items?: Json
          order_id?: string
          owner_id?: string
          prep_time_minutes?: number | null
          served_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["kot_order_status"] | null
          table_number?: number | null
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kot_orders_assigned_chef_id_fkey"
            columns: ["assigned_chef_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kot_orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      kot_settings: {
        Row: {
          auto_assign_enabled: boolean | null
          created_at: string
          default_prep_time_minutes: number | null
          id: string
          kot_enabled: boolean | null
          order_assignment_mode:
            | Database["public"]["Enums"]["order_assignment_mode"]
            | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          auto_assign_enabled?: boolean | null
          created_at?: string
          default_prep_time_minutes?: number | null
          id?: string
          kot_enabled?: boolean | null
          order_assignment_mode?:
            | Database["public"]["Enums"]["order_assignment_mode"]
            | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          auto_assign_enabled?: boolean | null
          created_at?: string
          default_prep_time_minutes?: number | null
          id?: string
          kot_enabled?: boolean | null
          order_assignment_mode?:
            | Database["public"]["Enums"]["order_assignment_mode"]
            | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          gstin: string | null
          id: string
          logo_url: string | null
          owner_name: string | null
          phone: string | null
          restaurant_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          restaurant_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          restaurant_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          chef_status: Database["public"]["Enums"]["chef_status"] | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          owner_id: string
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          chef_status?: Database["public"]["Enums"]["chef_status"] | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          owner_id: string
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          chef_status?: Database["public"]["Enums"]["chef_status"] | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          plan_name: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan_name?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          plan_name?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_staff_owner_id: { Args: { _user_id: string }; Returns: string }
      get_staff_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      is_manager_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      chef_status: "online" | "offline" | "break"
      kot_order_status:
        | "pending"
        | "assigned"
        | "preparing"
        | "completed"
        | "served"
        | "cancelled"
      order_assignment_mode: "auto" | "claim" | "manual"
      staff_role: "owner" | "manager" | "waiter" | "chef"
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
      chef_status: ["online", "offline", "break"],
      kot_order_status: [
        "pending",
        "assigned",
        "preparing",
        "completed",
        "served",
        "cancelled",
      ],
      order_assignment_mode: ["auto", "claim", "manual"],
      staff_role: ["owner", "manager", "waiter", "chef"],
    },
  },
} as const
