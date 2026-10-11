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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      custom_items: {
        Row: {
          base_material: string
          created_at: string
          display_name: string
          icon_path: string | null
          key: string
          max_stack: number
          registered_by: string
          sample: string
          source: string
          updated_at: string
        }
        Insert: {
          base_material: string
          created_at?: string
          display_name: string
          icon_path?: string | null
          key: string
          max_stack: number
          registered_by: string
          sample: string
          source: string
          updated_at?: string
        }
        Update: {
          base_material?: string
          created_at?: string
          display_name?: string
          icon_path?: string | null
          key?: string
          max_stack?: number
          registered_by?: string
          sample?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_items_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      escrow_items: {
        Row: {
          deposited_at: string
          id: string
          item_data: string
          listing_id: string
          order_id: string | null
          returned_at: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          updated_at: string
        }
        Insert: {
          deposited_at?: string
          id?: string
          item_data: string
          listing_id: string
          order_id?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Update: {
          deposited_at?: string
          id?: string
          item_data?: string
          listing_id?: string
          order_id?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_inventory"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "escrow_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_stock"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "escrow_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      inks: {
        Row: {
          created_at: string
          dark: string
          key: string
          light: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          dark: string
          key: string
          light: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          dark?: string
          key?: string
          light?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          player_uuid: string
          redeemed_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          player_uuid: string
          redeemed_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          player_uuid?: string
          redeemed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_codes_player_uuid_fkey"
            columns: ["player_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          description: string
          id: string
          item_key: string
          match_mode: string
          material: string
          photo_path: string | null
          photo_updated_at: string | null
          sample: string | null
          sample_set_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          unit_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          item_key: string
          match_mode?: string
          material: string
          photo_path?: string | null
          photo_updated_at?: string | null
          sample?: string | null
          sample_set_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          unit_amount: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_key?: string
          match_mode?: string
          material?: string
          photo_path?: string | null
          photo_updated_at?: string | null
          sample?: string | null
          sample_set_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          unit_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          world: string
          x: number
          y: number
          z: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          world: string
          x: number
          y: number
          z: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          world?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: []
      }
      mailboxes: {
        Row: {
          created_at: string
          id: string
          owner_uuid: string
          world: string
          x: number
          y: number
          z: number
        }
        Insert: {
          created_at?: string
          id?: string
          owner_uuid: string
          world: string
          x: number
          y: number
          z: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_uuid?: string
          world?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_owner_uuid_fkey"
            columns: ["owner_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_uuid: string
          collected_at: string | null
          courier_amount: number
          courier_paid_at: string | null
          courier_uuid: string | null
          created_at: string
          delivery_method: string
          express_fee: number
          failure_reason: string | null
          id: string
          listing_id: string
          locker_id: string | null
          mailbox_id: string | null
          paid_at: string | null
          processing_started_at: string | null
          quantity: number
          ready_at: string | null
          seller_paid_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          buyer_uuid: string
          collected_at?: string | null
          courier_amount?: number
          courier_paid_at?: string | null
          courier_uuid?: string | null
          created_at?: string
          delivery_method?: string
          express_fee?: number
          failure_reason?: string | null
          id?: string
          listing_id: string
          locker_id?: string | null
          mailbox_id?: string | null
          paid_at?: string | null
          processing_started_at?: string | null
          quantity: number
          ready_at?: string | null
          seller_paid_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          buyer_uuid?: string
          collected_at?: string | null
          courier_amount?: number
          courier_paid_at?: string | null
          courier_uuid?: string | null
          created_at?: string
          delivery_method?: string
          express_fee?: number
          failure_reason?: string | null
          id?: string
          listing_id?: string
          locker_id?: string | null
          mailbox_id?: string | null
          paid_at?: string | null
          processing_started_at?: string | null
          quantity?: number
          ready_at?: string | null
          seller_paid_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_uuid_fkey"
            columns: ["buyer_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_inventory"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_stock"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          last_seen_at: string
          name: string
          shop_slots: number | null
          uuid: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          name: string
          shop_slots?: number | null
          uuid: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          name?: string
          shop_slots?: number | null
          uuid?: string
        }
        Relationships: []
      }
      plugin_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_uuid: string
          body: string
          created_at: string
          id: string
          listing_id: string
          order_id: string
          rating: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          author_uuid: string
          body?: string
          created_at?: string
          id?: string
          listing_id: string
          order_id: string
          rating: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          author_uuid?: string
          body?: string
          created_at?: string
          id?: string
          listing_id?: string
          order_id?: string
          rating?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_uuid_fkey"
            columns: ["author_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_inventory"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_stock"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_computers: {
        Row: {
          created_at: string
          id: string
          kind: string
          placed_by: string
          shop_id: string
          world: string
          x: number
          y: number
          z: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          placed_by: string
          shop_id: string
          world: string
          x: number
          y: number
          z: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          placed_by?: string
          shop_id?: string
          world?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_computers_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "shop_computers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_computers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_computers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_computers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          added_by: string
          created_at: string
          player_uuid: string
          role_id: string | null
          shop_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          player_uuid: string
          role_id?: string | null
          shop_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          player_uuid?: string
          role_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "shop_members_player_uuid_fkey"
            columns: ["player_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "shop_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "shop_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_roles: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          permissions: string[]
          position: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          permissions?: string[]
          position?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          permissions?: string[]
          position?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_slug_history: {
        Row: {
          changed_at: string
          shop_id: string
          slug: string
        }
        Insert: {
          changed_at?: string
          shop_id: string
          slug: string
        }
        Update: {
          changed_at?: string
          shop_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_slug_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_slug_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_slug_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "shop_slug_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          banner_path: string | null
          courier_commission_mode: string
          courier_commission_value: number
          created_at: string
          description: string
          featured_listing_ids: string[]
          id: string
          ink: string
          logo_path: string | null
          name: string
          official: boolean
          owner_uuid: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          show_location: boolean
          slug: string
          status: Database["public"]["Enums"]["shop_status"]
          tagline: string
          updated_at: string
          zone_max_x: number | null
          zone_max_y: number | null
          zone_max_z: number | null
          zone_min_x: number | null
          zone_min_y: number | null
          zone_min_z: number | null
          zone_world: string | null
        }
        Insert: {
          banner_path?: string | null
          courier_commission_mode?: string
          courier_commission_value?: number
          created_at?: string
          description?: string
          featured_listing_ids?: string[]
          id?: string
          ink?: string
          logo_path?: string | null
          name: string
          official?: boolean
          owner_uuid: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          show_location?: boolean
          slug: string
          status?: Database["public"]["Enums"]["shop_status"]
          tagline?: string
          updated_at?: string
          zone_max_x?: number | null
          zone_max_y?: number | null
          zone_max_z?: number | null
          zone_min_x?: number | null
          zone_min_y?: number | null
          zone_min_z?: number | null
          zone_world?: string | null
        }
        Update: {
          banner_path?: string | null
          courier_commission_mode?: string
          courier_commission_value?: number
          created_at?: string
          description?: string
          featured_listing_ids?: string[]
          id?: string
          ink?: string
          logo_path?: string | null
          name?: string
          official?: boolean
          owner_uuid?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          show_location?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["shop_status"]
          tagline?: string
          updated_at?: string
          zone_max_x?: number | null
          zone_max_y?: number | null
          zone_max_z?: number | null
          zone_min_x?: number | null
          zone_min_y?: number | null
          zone_min_z?: number | null
          zone_world?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_ink_fkey"
            columns: ["ink"]
            isOneToOne: false
            referencedRelation: "inks"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "shops_owner_uuid_fkey"
            columns: ["owner_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "shops_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          granted_by: string | null
          player_uuid: string
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          player_uuid: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          player_uuid?: string
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "staff_player_uuid_fkey"
            columns: ["player_uuid"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      storage_blocks: {
        Row: {
          capacity: number
          created_at: string
          id: string
          placed_by: string
          shop_id: string
          type_id: string | null
          world: string
          x: number
          y: number
          z: number
        }
        Insert: {
          capacity: number
          created_at?: string
          id?: string
          placed_by: string
          shop_id: string
          type_id?: string | null
          world: string
          x: number
          y: number
          z: number
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          placed_by?: string
          shop_id?: string
          type_id?: string | null
          world?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "storage_blocks_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "storage_blocks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "storage_blocks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_blocks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "storage_blocks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_blocks_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "storage_types"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_types: {
        Row: {
          buyable: boolean
          capacity: number
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          material: string
          price: number
          updated_at: string
        }
        Insert: {
          buyable?: boolean
          capacity: number
          created_at?: string
          created_by?: string | null
          display_name: string
          id: string
          material: string
          price: number
          updated_at?: string
        }
        Update: {
          buyable?: boolean
          capacity?: number
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          material?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          starts_at: string | null
          tokens: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          starts_at?: string | null
          tokens?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string | null
          tokens?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
      web_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          player_uuid: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          player_uuid: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          player_uuid?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_sessions_player_uuid_fkey"
            columns: ["player_uuid"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["uuid"]
          },
        ]
      }
    }
    Views: {
      catalog: {
        Row: {
          category: string | null
          created_at: string | null
          custom_icon_path: string | null
          custom_name: string | null
          description: string | null
          id: string | null
          item_key: string | null
          match_mode: string | null
          material: string | null
          photo_path: string | null
          price_per_item: number | null
          rating_avg: number | null
          rating_count: number | null
          search_text: string | null
          shop_id: string | null
          shop_ink: string | null
          shop_name: string | null
          shop_official: boolean | null
          shop_slug: string | null
          title: string | null
          unit_amount: number | null
          unit_price: number | null
          units_available: number | null
          units_sold: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_ink_fkey"
            columns: ["shop_ink"]
            isOneToOne: false
            referencedRelation: "inks"
            referencedColumns: ["key"]
          },
        ]
      }
      current_theme: {
        Row: {
          id: string | null
          name: string | null
          tokens: Json | null
        }
        Relationships: []
      }
      listing_inventory: {
        Row: {
          available: number | null
          delivered: number | null
          listing_id: string | null
          reserved: number | null
          returned: number | null
        }
        Relationships: []
      }
      listing_stock: {
        Row: {
          listing_id: string | null
          units_available: number | null
        }
        Relationships: []
      }
      public_reviews: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string | null
          id: string | null
          listing_id: string | null
          listing_title: string | null
          rating: number | null
          shop_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_inventory"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_stock"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "catalog"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_storage"
            referencedColumns: ["shop_id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_directory: {
        Row: {
          banner_path: string | null
          created_at: string | null
          description: string | null
          id: string | null
          ink: string | null
          listing_count: number | null
          logo_path: string | null
          name: string | null
          official: boolean | null
          owner_name: string | null
          rating_avg: number | null
          rating_count: number | null
          slug: string | null
          tagline: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_ink_fkey"
            columns: ["ink"]
            isOneToOne: false
            referencedRelation: "inks"
            referencedColumns: ["key"]
          },
        ]
      }
      shop_storage: {
        Row: {
          capacity_units: number | null
          shop_id: string | null
          storage_blocks: number | null
          used_units: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      default_shop_roles_json: { Args: never; Returns: Json }
      default_shop_slots: { Args: never; Returns: number }
      ensure_shop_roles: { Args: { p_shop: string }; Returns: undefined }
      material_category: { Args: { material: string }; Returns: string }
      max_shop_memberships: { Args: never; Returns: number }
      redeem_link_code: {
        Args: { p_code: string; p_session_days: number; p_token_hash: string }
        Returns: {
          player_id: string
          player_name: string
        }[]
      }
      set_active_theme: { Args: { p_theme_id: string }; Returns: undefined }
      set_default_shop_role: {
        Args: { p_role: string; p_shop: string }
        Returns: boolean
      }
      shop_member_can: {
        Args: { p_permission: string; p_player: string; p_shop: string }
        Returns: boolean
      }
      shop_memberships_of: {
        Args: { p_player: string }
        Returns: {
          free: number
          max_memberships: number
          used: number
        }[]
      }
      shop_permission_list: { Args: never; Returns: string[] }
      shop_permissions_of: {
        Args: { p_player: string; p_shop: string }
        Returns: string[]
      }
      shop_slots_of: {
        Args: { p_player: string }
        Returns: {
          custom: boolean
          free: number
          slots: number
          used: number
        }[]
      }
    }
    Enums: {
      escrow_status: "AVAILABLE" | "RESERVED" | "DELIVERED" | "RETURNED"
      listing_status: "ACTIVE" | "PAUSED" | "REMOVED"
      order_status:
        | "PENDING"
        | "PAID"
        | "READY"
        | "COLLECTED"
        | "FAILED"
        | "REFUNDED"
      shop_status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"
      staff_role: "ADMIN" | "SUPERADMIN"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      escrow_status: ["AVAILABLE", "RESERVED", "DELIVERED", "RETURNED"],
      listing_status: ["ACTIVE", "PAUSED", "REMOVED"],
      order_status: [
        "PENDING",
        "PAID",
        "READY",
        "COLLECTED",
        "FAILED",
        "REFUNDED",
      ],
      shop_status: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
      staff_role: ["ADMIN", "SUPERADMIN"],
    },
  },
} as const
