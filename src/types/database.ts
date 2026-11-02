export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          organization_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      ticket_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          is_internal: boolean;
          organization_id: string;
          ticket_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          organization_id: string;
          ticket_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          organization_id?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_comments_organization_id_ticket_id_fkey";
            columns: ["organization_id", "ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      ticket_counters: {
        Row: {
          last_number: number;
          organization_id: string;
        };
        ComputedFields: never;
        Insert: {
          last_number?: number;
          organization_id: string;
        };
        Update: {
          last_number?: number;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_counters_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          new_value: string | null;
          old_value: string | null;
          organization_id: string;
          ticket_id: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          organization_id: string;
          ticket_id: string;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          organization_id?: string;
          ticket_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_events_organization_id_ticket_id_fkey";
            columns: ["organization_id", "ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      tickets: {
        Row: {
          assignee_id: string | null;
          category_id: string | null;
          created_at: string;
          description: string;
          due_at: string | null;
          id: string;
          number: number;
          organization_id: string;
          priority: Database["public"]["Enums"]["ticket_priority"];
          requester_id: string | null;
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          due_at?: string | null;
          id?: string;
          number?: number;
          organization_id: string;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          requester_id?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          due_at?: string | null;
          id?: string;
          number?: number;
          organization_id?: string;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          requester_id?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_assignee_membership_fkey";
            columns: ["organization_id", "assignee_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
          {
            foreignKeyName: "tickets_category_fkey";
            columns: ["organization_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "tickets_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_requester_membership_fkey";
            columns: ["organization_id", "requester_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_member_by_email: {
        Args: {
          member_email: string;
          member_role: Database["public"]["Enums"]["member_role"];
          org: string;
        };
        Returns: string;
      };
      create_organization: { Args: { org_name: string }; Returns: string };
      ticket_stats: { Args: { org: string }; Returns: Json };
    };
    Enums: {
      member_role: "admin" | "agent" | "requester";
      ticket_priority: "niedrig" | "mittel" | "hoch" | "kritisch";
      ticket_status: "neu" | "in_bearbeitung" | "wartet" | "geloest" | "geschlossen";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      member_role: ["admin", "agent", "requester"],
      ticket_priority: ["niedrig", "mittel", "hoch", "kritisch"],
      ticket_status: ["neu", "in_bearbeitung", "wartet", "geloest", "geschlossen"],
    },
  },
} as const;
