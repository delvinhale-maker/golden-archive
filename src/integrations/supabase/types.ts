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
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          item_count: number
          items: Json
          recovered: boolean
          recovered_at: string | null
          reminder_sent_at: string | null
          session_id: string
          subtotal: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          item_count?: number
          items?: Json
          recovered?: boolean
          recovered_at?: string | null
          reminder_sent_at?: string | null
          session_id: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          item_count?: number
          items?: Json
          recovered?: boolean
          recovered_at?: string | null
          reminder_sent_at?: string | null
          session_id?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_url: string
          clicked_at: string
          id: string
          product_id: string
          source: string
          user_id: string | null
        }
        Insert: {
          affiliate_url: string
          clicked_at?: string
          id?: string
          product_id: string
          source: string
          user_id?: string | null
        }
        Update: {
          affiliate_url?: string
          clicked_at?: string
          id?: string
          product_id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "affiliate_products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_user_id: string
          commission_cents: number
          commission_rate_pct: number
          created_at: string
          creator_id: string
          id: string
          order_id: string
          order_item_id: string
          referral_code: string
          sale_amount_cents: number
          status: string
        }
        Insert: {
          affiliate_user_id: string
          commission_cents: number
          commission_rate_pct: number
          created_at?: string
          creator_id: string
          id?: string
          order_id: string
          order_item_id: string
          referral_code: string
          sale_amount_cents: number
          status?: string
        }
        Update: {
          affiliate_user_id?: string
          commission_cents?: number
          commission_rate_pct?: number
          created_at?: string
          creator_id?: string
          id?: string
          order_id?: string
          order_item_id?: string
          referral_code?: string
          sale_amount_cents?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_products: {
        Row: {
          active: boolean
          affiliate_url: string
          badge: string | null
          category: string
          created_at: string
          description: string
          featured: boolean
          id: string
          image_url: string
          original_price: number | null
          price: number
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_url: string
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          image_url: string
          original_price?: number | null
          price?: number
          source: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_url?: string
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          image_url?: string
          original_price?: number | null
          price?: number
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_referral_clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string | null
          product_id: string | null
          referral_code: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          product_id?: string | null
          referral_code: string
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          product_id?: string | null
          referral_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referral_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_release_runs: {
        Row: {
          candidate_count: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          released_count: number
          released_ids: string[]
          status: string
          triggered_by: string
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          released_count?: number
          released_ids?: string[]
          status: string
          triggered_by?: string
        }
        Update: {
          candidate_count?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          released_count?: number
          released_ids?: string[]
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string
          name: string
          status: string
          topic: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message: string
          name: string
          status?: string
          topic?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string
          name?: string
          status?: string
          topic?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      cover_audit_alert_config: {
        Row: {
          cooldown_minutes: number
          created_at: string
          enabled: boolean
          id: number
          last_alert_at: string | null
          recipient_email: string | null
          threshold: number
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: number
          last_alert_at?: string | null
          recipient_email?: string | null
          threshold?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: number
          last_alert_at?: string | null
          recipient_email?: string | null
          threshold?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      cover_audit_runs: {
        Row: {
          category: string
          checked_at: string
          failing: number
          failing_rows: Json
          ok: boolean
          passing: number
          results: Json
          total: number
        }
        Insert: {
          category: string
          checked_at?: string
          failing: number
          failing_rows: Json
          ok: boolean
          passing: number
          results: Json
          total: number
        }
        Update: {
          category?: string
          checked_at?: string
          failing?: number
          failing_rows?: Json
          ok?: boolean
          passing?: number
          results?: Json
          total?: number
        }
        Relationships: []
      }
      creator_affiliate_programs: {
        Row: {
          commission_rate_pct: number
          created_at: string
          creator_id: string
          enabled: boolean
          terms: string | null
          updated_at: string
        }
        Insert: {
          commission_rate_pct?: number
          created_at?: string
          creator_id: string
          enabled?: boolean
          terms?: string | null
          updated_at?: string
        }
        Update: {
          commission_rate_pct?: number
          created_at?: string
          creator_id?: string
          enabled?: boolean
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creator_affiliates: {
        Row: {
          affiliate_user_id: string
          creator_id: string
          id: string
          joined_at: string
          referral_code: string
          status: string
        }
        Insert: {
          affiliate_user_id: string
          creator_id: string
          id?: string
          joined_at?: string
          referral_code: string
          status?: string
        }
        Update: {
          affiliate_user_id?: string
          creator_id?: string
          id?: string
          joined_at?: string
          referral_code?: string
          status?: string
        }
        Relationships: []
      }
      creator_bundle_items: {
        Row: {
          bundle_id: string
          position: number
          product_id: string
        }
        Insert: {
          bundle_id: string
          position?: number
          product_id: string
        }
        Update: {
          bundle_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "creator_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_bundles: {
        Row: {
          compare_at_price_cents: number | null
          created_at: string
          description: string | null
          id: string
          price_cents: number
          published: boolean
          seller_id: string
          title: string
          updated_at: string
        }
        Insert: {
          compare_at_price_cents?: number | null
          created_at?: string
          description?: string | null
          id?: string
          price_cents: number
          published?: boolean
          seller_id: string
          title: string
          updated_at?: string
        }
        Update: {
          compare_at_price_cents?: number | null
          created_at?: string
          description?: string | null
          id?: string
          price_cents?: number
          published?: boolean
          seller_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_followers: {
        Row: {
          created_at: string
          creator_user_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          creator_user_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          creator_user_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          alerted_at: string | null
          context: Json
          fingerprint: string | null
          id: string
          message: string
          occurred_at: string
          route: string | null
          severity: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          alerted_at?: string | null
          context?: Json
          fingerprint?: string | null
          id?: string
          message: string
          occurred_at?: string
          route?: string | null
          severity?: string
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          alerted_at?: string | null
          context?: Json
          fingerprint?: string | null
          id?: string
          message?: string
          occurred_at?: string
          route?: string | null
          severity?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      marketplace_products: {
        Row: {
          admin_notes: string | null
          ai_review_blurb: string | null
          ai_review_issues: Json | null
          ai_review_score: number | null
          ai_review_seo_title: string | null
          ai_review_status: string | null
          ai_review_tags: Json | null
          ai_reviewed_at: string | null
          approved_at: string | null
          category: Database["public"]["Enums"]["product_category"]
          compare_at_price_cents: number | null
          cover_url: string | null
          created_at: string
          creator_name: string | null
          description: string
          featured: boolean
          file_path: string | null
          file_size_bytes: number | null
          id: string
          language: string
          platform_fee_pct: number
          price_cents: number
          published: boolean
          rejected_reason: string | null
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          ai_review_blurb?: string | null
          ai_review_issues?: Json | null
          ai_review_score?: number | null
          ai_review_seo_title?: string | null
          ai_review_status?: string | null
          ai_review_tags?: Json | null
          ai_reviewed_at?: string | null
          approved_at?: string | null
          category: Database["public"]["Enums"]["product_category"]
          compare_at_price_cents?: number | null
          cover_url?: string | null
          created_at?: string
          creator_name?: string | null
          description: string
          featured?: boolean
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          language?: string
          platform_fee_pct?: number
          price_cents: number
          published?: boolean
          rejected_reason?: string | null
          seller_id: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          ai_review_blurb?: string | null
          ai_review_issues?: Json | null
          ai_review_score?: number | null
          ai_review_seo_title?: string | null
          ai_review_status?: string | null
          ai_review_tags?: Json | null
          ai_reviewed_at?: string | null
          approved_at?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          compare_at_price_cents?: number | null
          cover_url?: string | null
          created_at?: string
          creator_name?: string | null
          description?: string
          featured?: boolean
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          language?: string
          platform_fee_pct?: number
          price_cents?: number
          published?: boolean
          rejected_reason?: string | null
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_downloads: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string
          id: string
          max_downloads: number
          order_item_id: string
          token: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at?: string
          id?: string
          max_downloads?: number
          order_item_id: string
          token: string
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string
          id?: string
          max_downloads?: number
          order_item_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_downloads_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          platform_fee_cents: number
          product_id: string
          product_title: string
          seller_amount_cents: number
          seller_id: string
          unit_amount_cents: number
          variant_id: string | null
          variant_license_type:
            | Database["public"]["Enums"]["product_license_type"]
            | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          platform_fee_cents: number
          product_id: string
          product_title: string
          seller_amount_cents: number
          seller_id: string
          unit_amount_cents: number
          variant_id?: string | null
          variant_license_type?:
            | Database["public"]["Enums"]["product_license_type"]
            | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          platform_fee_cents?: number
          product_id?: string
          product_title?: string
          seller_amount_cents?: number
          seller_id?: string
          unit_amount_cents?: number
          variant_id?: string | null
          variant_license_type?:
            | Database["public"]["Enums"]["product_license_type"]
            | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          buyer_email: string
          created_at: string
          currency: string
          environment: string
          id: string
          referral_code: string | null
          referrer_user_id: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          buyer_email: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          referral_code?: string | null
          referrer_user_id?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          buyer_email?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          referral_code?: string | null
          referrer_user_id?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payout_release_runs: {
        Row: {
          created_at: string
          eligible_pending_cents: number
          eligible_seller_count: number
          id: string
          next_release_at: string | null
          notes: string | null
          ran_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          eligible_pending_cents?: number
          eligible_seller_count?: number
          id?: string
          next_release_at?: string | null
          notes?: string | null
          ran_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          eligible_pending_cents?: number
          eligible_seller_count?: number
          id?: string
          next_release_at?: string | null
          notes?: string | null
          ran_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      product_publish_history: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          from_published: boolean | null
          from_status: string | null
          id: string
          note: string | null
          product_id: string
          seller_id: string
          to_published: boolean | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          from_published?: boolean | null
          from_status?: string | null
          id?: string
          note?: string | null
          product_id: string
          seller_id: string
          to_published?: boolean | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          from_published?: boolean | null
          from_status?: string | null
          id?: string
          note?: string | null
          product_id?: string
          seller_id?: string
          to_published?: boolean | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_publish_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_qa: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by_admin: boolean
          answerer_name: string | null
          answerer_user_id: string | null
          asker_name: string
          asker_user_id: string | null
          created_at: string
          id: string
          product_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by_admin?: boolean
          answerer_name?: string | null
          answerer_user_id?: string | null
          asker_name: string
          asker_user_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by_admin?: boolean
          answerer_name?: string | null
          answerer_user_id?: string | null
          asker_name?: string
          asker_user_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_qa_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          body: string
          created_at: string
          helpful_count: number
          id: string
          is_seed: boolean
          photo_url: string | null
          product_id: string
          rating: number
          reviewer_avatar: string | null
          reviewer_name: string
          title: string | null
          updated_at: string
          user_id: string | null
          verified_purchase: boolean
        }
        Insert: {
          body: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_seed?: boolean
          photo_url?: string | null
          product_id: string
          rating: number
          reviewer_avatar?: string | null
          reviewer_name: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
          verified_purchase?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_seed?: boolean
          photo_url?: string | null
          product_id?: string
          rating?: number
          reviewer_avatar?: string | null
          reviewer_name?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          is_active: boolean
          license_type:
            | Database["public"]["Enums"]["product_license_type"]
            | null
          min_price_cents: number | null
          name: string
          pay_what_you_want: boolean
          price_cents: number
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          license_type?:
            | Database["public"]["Enums"]["product_license_type"]
            | null
          min_price_cents?: number | null
          name: string
          pay_what_you_want?: boolean
          price_cents?: number
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          license_type?:
            | Database["public"]["Enums"]["product_license_type"]
            | null
          min_price_cents?: number | null
          name?: string
          pay_what_you_want?: boolean
          price_cents?: number
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_seller: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_seller?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_seller?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          first_order_at: string | null
          first_order_id: string | null
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_order_at?: string | null
          first_order_id?: string | null
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_order_at?: string | null
          first_order_id?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_helpful_votes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_applications: {
        Row: {
          admin_feedback: string | null
          admin_notes: string | null
          applicant_email: string | null
          brand_name: string
          brand_slug: string | null
          categories: string[] | null
          country: string | null
          cover_url: string | null
          created_at: string
          credentials: string[] | null
          extended_bio: string | null
          featured_media_url: string | null
          id: string
          pitch: string
          price_range: string | null
          product_types: string | null
          reapply_after: string | null
          reviewed_at: string | null
          social_links: Json | null
          status: Database["public"]["Enums"]["application_status"]
          story: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          admin_feedback?: string | null
          admin_notes?: string | null
          applicant_email?: string | null
          brand_name: string
          brand_slug?: string | null
          categories?: string[] | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          credentials?: string[] | null
          extended_bio?: string | null
          featured_media_url?: string | null
          id?: string
          pitch: string
          price_range?: string | null
          product_types?: string | null
          reapply_after?: string | null
          reviewed_at?: string | null
          social_links?: Json | null
          status?: Database["public"]["Enums"]["application_status"]
          story?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          admin_feedback?: string | null
          admin_notes?: string | null
          applicant_email?: string | null
          brand_name?: string
          brand_slug?: string | null
          categories?: string[] | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          credentials?: string[] | null
          extended_bio?: string | null
          featured_media_url?: string | null
          id?: string
          pitch?: string
          price_range?: string | null
          product_types?: string | null
          reapply_after?: string | null
          reviewed_at?: string | null
          social_links?: Json | null
          status?: Database["public"]["Enums"]["application_status"]
          story?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      seller_balances: {
        Row: {
          currency: string
          paid_cents: number
          pending_cents: number
          seller_id: string
          updated_at: string
        }
        Insert: {
          currency?: string
          paid_cents?: number
          pending_cents?: number
          seller_id: string
          updated_at?: string
        }
        Update: {
          currency?: string
          paid_cents?: number
          pending_cents?: number
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          method: string | null
          note: string | null
          paid_at: string
          paid_by: string | null
          seller_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          seller_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          seller_id?: string
        }
        Relationships: []
      }
      slug_integrity_alerts: {
        Row: {
          details: Json
          duplicate_group_count: number
          id: string
          index_present: boolean
          missing_slug_count: number
          ran_at: string
          status: string
        }
        Insert: {
          details?: Json
          duplicate_group_count?: number
          id?: string
          index_present?: boolean
          missing_slug_count?: number
          ran_at?: string
          status: string
        }
        Update: {
          details?: Json
          duplicate_group_count?: number
          id?: string
          index_present?: boolean
          missing_slug_count?: number
          ran_at?: string
          status?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          source: string
          status: string
        }
        Insert: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string
          status?: string
        }
        Update: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_record_seller_payout: {
        Args: {
          _amount_cents: number
          _method?: string
          _note?: string
          _seller_id: string
        }
        Returns: string
      }
      brand_slugify: { Args: { _name: string }; Returns: string }
      confirm_subscriber: { Args: { _token: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_product_qa: {
        Args: { _product_id: string }
        Returns: {
          answer: string
          answered_at: string
          answered_by_admin: boolean
          answerer_name: string
          asker_name: string
          created_at: string
          id: string
          product_id: string
          question: string
        }[]
      }
      mark_abandoned_cart_recovered: {
        Args: { _session_id: string }
        Returns: undefined
      }
      marketplace_products_slugify: {
        Args: { _title: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      run_slug_integrity_check: {
        Args: never
        Returns: {
          details: Json
          duplicate_group_count: number
          id: string
          index_present: boolean
          missing_slug_count: number
          ran_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "slug_integrity_alerts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_abandoned_cart: {
        Args: {
          _email?: string
          _item_count: number
          _items: Json
          _session_id: string
          _subtotal: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "buyer"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "under_review"
        | "info_requested"
      product_category:
        | "ebooks"
        | "courses"
        | "templates"
        | "audio"
        | "leadership"
        | "finance"
        | "purpose"
        | "business"
      product_license_type: "personal" | "commercial" | "extended"
      product_status: "draft" | "pending" | "approved" | "rejected"
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
      app_role: ["admin", "seller", "buyer"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "under_review",
        "info_requested",
      ],
      product_category: [
        "ebooks",
        "courses",
        "templates",
        "audio",
        "leadership",
        "finance",
        "purpose",
        "business",
      ],
      product_license_type: ["personal", "commercial", "extended"],
      product_status: ["draft", "pending", "approved", "rejected"],
    },
  },
} as const
