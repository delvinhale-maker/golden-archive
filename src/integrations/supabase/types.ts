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
      academy_article_products: {
        Row: {
          article_id: string
          created_at: string
          product_id: string
          sort_order: number
        }
        Insert: {
          article_id: string
          created_at?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          article_id?: string
          created_at?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_article_products_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "academy_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_article_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_article_related: {
        Row: {
          article_id: string
          related_id: string
          sort_order: number
        }
        Insert: {
          article_id: string
          related_id: string
          sort_order?: number
        }
        Update: {
          article_id?: string
          related_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_article_related_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "academy_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_article_related_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "academy_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_article_versions: {
        Row: {
          article_id: string
          id: string
          saved_at: string
          saved_by: string | null
          snapshot: Json
        }
        Insert: {
          article_id: string
          id?: string
          saved_at?: string
          saved_by?: string | null
          snapshot: Json
        }
        Update: {
          article_id?: string
          id?: string
          saved_at?: string
          saved_by?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "academy_article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "academy_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_articles: {
        Row: {
          archived: boolean
          author_id: string | null
          author_name: string | null
          body: string
          canonical_url: string | null
          category: string
          cover_alt: string | null
          cover_caption: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["academy_difficulty"]
          editors_pick: boolean
          excerpt: string | null
          featured: boolean
          featured_image: string | null
          focus_keyword: string | null
          id: string
          is_latest: boolean
          last_autosaved_at: string | null
          meta_description: string | null
          meta_title: string | null
          og_description: string | null
          og_title: string | null
          pinned: boolean
          published_at: string | null
          reading_time_min: number
          robots_follow: boolean
          robots_index: boolean
          scheduled_for: string | null
          schema_type: string
          secondary_keywords: string[]
          slug: string
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          twitter_card: string
          updated_at: string
          view_count: number
          word_count: number
        }
        Insert: {
          archived?: boolean
          author_id?: string | null
          author_name?: string | null
          body?: string
          canonical_url?: string | null
          category: string
          cover_alt?: string | null
          cover_caption?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["academy_difficulty"]
          editors_pick?: boolean
          excerpt?: string | null
          featured?: boolean
          featured_image?: string | null
          focus_keyword?: string | null
          id?: string
          is_latest?: boolean
          last_autosaved_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_title?: string | null
          pinned?: boolean
          published_at?: string | null
          reading_time_min?: number
          robots_follow?: boolean
          robots_index?: boolean
          scheduled_for?: string | null
          schema_type?: string
          secondary_keywords?: string[]
          slug: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title: string
          twitter_card?: string
          updated_at?: string
          view_count?: number
          word_count?: number
        }
        Update: {
          archived?: boolean
          author_id?: string | null
          author_name?: string | null
          body?: string
          canonical_url?: string | null
          category?: string
          cover_alt?: string | null
          cover_caption?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["academy_difficulty"]
          editors_pick?: boolean
          excerpt?: string | null
          featured?: boolean
          featured_image?: string | null
          focus_keyword?: string | null
          id?: string
          is_latest?: boolean
          last_autosaved_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_title?: string | null
          pinned?: boolean
          published_at?: string | null
          reading_time_min?: number
          robots_follow?: boolean
          robots_index?: boolean
          scheduled_for?: string | null
          schema_type?: string
          secondary_keywords?: string[]
          slug?: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          twitter_card?: string
          updated_at?: string
          view_count?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_articles_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "academy_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      academy_bookmarks: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_bookmarks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "academy_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_categories: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          name?: string
          slug?: string
          sort_order?: number
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
          deal_active: boolean
          deal_expires_at: string | null
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
          deal_active?: boolean
          deal_expires_at?: string | null
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
          deal_active?: boolean
          deal_expires_at?: string | null
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
      creator_activation: {
        Row: {
          approved_at: string | null
          created_at: string
          first_product_approved_at: string | null
          first_product_published_at: string | null
          first_product_started_at: string | null
          first_product_submitted_at: string | null
          first_sale_at: string | null
          nudge_first_product_sent_at: string | null
          nudge_profile_sent_at: string | null
          profile_completed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          first_product_approved_at?: string | null
          first_product_published_at?: string | null
          first_product_started_at?: string | null
          first_product_submitted_at?: string | null
          first_sale_at?: string | null
          nudge_first_product_sent_at?: string | null
          nudge_profile_sent_at?: string | null
          profile_completed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          first_product_approved_at?: string | null
          first_product_published_at?: string | null
          first_product_started_at?: string | null
          first_product_submitted_at?: string | null
          first_sale_at?: string | null
          nudge_first_product_sent_at?: string | null
          nudge_profile_sent_at?: string | null
          profile_completed_at?: string | null
          updated_at?: string
          user_id?: string
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
      creator_announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "creator_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          pinned: boolean
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          published?: boolean
          title?: string
          updated_at?: string
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
      creator_forum_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_forum_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "creator_forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_forum_posts: {
        Row: {
          author_id: string
          body: string
          category: Database["public"]["Enums"]["creator_forum_category"]
          created_at: string
          id: string
          likes_count: number
          reply_count: number
          status: Database["public"]["Enums"]["creator_forum_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string
          category?: Database["public"]["Enums"]["creator_forum_category"]
          created_at?: string
          id?: string
          likes_count?: number
          reply_count?: number
          status?: Database["public"]["Enums"]["creator_forum_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: Database["public"]["Enums"]["creator_forum_category"]
          created_at?: string
          id?: string
          likes_count?: number
          reply_count?: number
          status?: Database["public"]["Enums"]["creator_forum_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_forum_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "creator_forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_lead_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      creator_leads: {
        Row: {
          acquisition_type: string
          application_submitted_at: string | null
          consent_at: string | null
          consent_source: string | null
          converted_to_creator_at: string | null
          created_at: string
          cta_source: string | null
          email: string
          first_name: string | null
          follower_count: number
          id: string
          landing_page: string | null
          last_send_status: string | null
          lead_status: string
          marketing_consent: boolean
          normalized_email: string | null
          nurture_step2_sent_at: string | null
          nurture_step3_sent_at: string | null
          nurture_step4_sent_at: string | null
          nurture_step5_sent_at: string | null
          product_type: string
          referring_url: string | null
          seller_application_id: string | null
          starter_pack_last_sent_at: string | null
          starter_pack_requested_at: string | null
          starter_pack_send_count: number
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          acquisition_type?: string
          application_submitted_at?: string | null
          consent_at?: string | null
          consent_source?: string | null
          converted_to_creator_at?: string | null
          created_at?: string
          cta_source?: string | null
          email: string
          first_name?: string | null
          follower_count?: number
          id?: string
          landing_page?: string | null
          last_send_status?: string | null
          lead_status?: string
          marketing_consent?: boolean
          normalized_email?: string | null
          nurture_step2_sent_at?: string | null
          nurture_step3_sent_at?: string | null
          nurture_step4_sent_at?: string | null
          nurture_step5_sent_at?: string | null
          product_type?: string
          referring_url?: string | null
          seller_application_id?: string | null
          starter_pack_last_sent_at?: string | null
          starter_pack_requested_at?: string | null
          starter_pack_send_count?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          acquisition_type?: string
          application_submitted_at?: string | null
          consent_at?: string | null
          consent_source?: string | null
          converted_to_creator_at?: string | null
          created_at?: string
          cta_source?: string | null
          email?: string
          first_name?: string | null
          follower_count?: number
          id?: string
          landing_page?: string | null
          last_send_status?: string | null
          lead_status?: string
          marketing_consent?: boolean
          normalized_email?: string | null
          nurture_step2_sent_at?: string | null
          nurture_step3_sent_at?: string | null
          nurture_step4_sent_at?: string | null
          nurture_step5_sent_at?: string | null
          product_type?: string
          referring_url?: string | null
          seller_application_id?: string | null
          starter_pack_last_sent_at?: string | null
          starter_pack_requested_at?: string | null
          starter_pack_send_count?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_leads_seller_application_id_fkey"
            columns: ["seller_application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_methods: {
        Row: {
          created_at: string
          details: Json
          frequency: string
          method: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          frequency?: string
          method: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          frequency?: string
          method?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_prospects: {
        Row: {
          audience_size: number | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          id: string
          last_contacted_at: string | null
          name: string
          niche: string | null
          notes: string | null
          platform: string | null
          profile_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audience_size?: number | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_contacted_at?: string | null
          name: string
          niche?: string | null
          notes?: string | null
          platform?: string | null
          profile_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audience_size?: number | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_contacted_at?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          platform?: string | null
          profile_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_referrals: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      creator_spotlights: {
        Row: {
          created_at: string
          headline: string
          hero_image_url: string | null
          id: string
          interview_body: string
          month: string
          published: boolean
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          headline: string
          hero_image_url?: string | null
          id?: string
          interview_body?: string
          month: string
          published?: boolean
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          headline?: string
          hero_image_url?: string | null
          id?: string
          interview_body?: string
          month?: string
          published?: boolean
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_storefront_events: {
        Row: {
          created_at: string
          creator_user_id: string
          id: string
          kind: string
          product_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          creator_user_id: string
          id?: string
          kind: string
          product_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          creator_user_id?: string
          id?: string
          kind?: string
          product_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      creator_storefront_settings: {
        Row: {
          accent: string
          created_at: string
          featured_bundle_id: string | null
          featured_product_ids: string[]
          headline: string | null
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string
          created_at?: string
          featured_bundle_id?: string | null
          featured_product_ids?: string[]
          headline?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent?: string
          created_at?: string
          featured_bundle_id?: string | null
          featured_product_ids?: string[]
          headline?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_tax_forms: {
        Row: {
          admin_note: string | null
          created_at: string
          file_path: string
          form_type: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          file_path: string
          form_type: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id: string
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          file_path?: string
          form_type?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cta_click_events: {
        Row: {
          created_at: string
          cta_location: string
          id: string
          page_path: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          cta_location: string
          id?: string
          page_path?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          cta_location?: string
          id?: string
          page_path?: string | null
          session_id?: string
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
      founding_creators: {
        Row: {
          accepted_at: string
          accepted_by: string | null
          campaign_source: string | null
          created_at: string
          founding_number: number
          id: string
          lead_id: string | null
          seller_application_id: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_by?: string | null
          campaign_source?: string | null
          created_at?: string
          founding_number: number
          id?: string
          lead_id?: string | null
          seller_application_id?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string | null
          campaign_source?: string | null
          created_at?: string
          founding_number?: number
          id?: string
          lead_id?: string | null
          seller_application_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founding_creators_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "creator_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founding_creators_seller_application_id_fkey"
            columns: ["seller_application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_layout: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          key: string
          kind: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          kind: string
          label: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          kind?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_bundle_items: {
        Row: {
          bundle_id: string
          position: number
          product_id: string
          required: boolean
        }
        Insert: {
          bundle_id: string
          position?: number
          product_id: string
          required?: boolean
        }
        Update: {
          bundle_id?: string
          position?: number
          product_id?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "marketplace_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bundles: {
        Row: {
          created_at: string
          end_at: string | null
          featured: boolean
          full_description: string | null
          id: string
          image_url: string | null
          name: string
          owner_seller_id: string
          price_cents: number
          short_description: string | null
          slug: string
          start_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          featured?: boolean
          full_description?: string | null
          id?: string
          image_url?: string | null
          name: string
          owner_seller_id: string
          price_cents: number
          short_description?: string | null
          slug: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          featured?: boolean
          full_description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          owner_seller_id?: string
          price_cents?: number
          short_description?: string | null
          slug?: string
          start_at?: string | null
          status?: string
          updated_at?: string
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
          delivery_contents: string[]
          description: string
          featured: boolean
          file_path: string | null
          file_size_bytes: number | null
          has_interactive_edition: boolean
          id: string
          interactive_edition_file_url: string | null
          is_preorder: boolean
          language: string
          platform_fee_pct: number
          preorder_note: string | null
          preview_pages: number[]
          price_cents: number
          primary_bundle_file_id: string | null
          product_type: string | null
          published: boolean
          rejected_reason: string | null
          release_date: string | null
          released_at: string | null
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          subcategory: string | null
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
          delivery_contents?: string[]
          description: string
          featured?: boolean
          file_path?: string | null
          file_size_bytes?: number | null
          has_interactive_edition?: boolean
          id?: string
          interactive_edition_file_url?: string | null
          is_preorder?: boolean
          language?: string
          platform_fee_pct?: number
          preorder_note?: string | null
          preview_pages?: number[]
          price_cents: number
          primary_bundle_file_id?: string | null
          product_type?: string | null
          published?: boolean
          rejected_reason?: string | null
          release_date?: string | null
          released_at?: string | null
          seller_id: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          subcategory?: string | null
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
          delivery_contents?: string[]
          description?: string
          featured?: boolean
          file_path?: string | null
          file_size_bytes?: number | null
          has_interactive_edition?: boolean
          id?: string
          interactive_edition_file_url?: string | null
          is_preorder?: boolean
          language?: string
          platform_fee_pct?: number
          preorder_note?: string | null
          preview_pages?: number[]
          price_cents?: number
          primary_bundle_file_id?: string | null
          product_type?: string | null
          published?: boolean
          rejected_reason?: string | null
          release_date?: string | null
          released_at?: string | null
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          subcategory?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_primary_bundle_file_fk"
            columns: ["primary_bundle_file_id"]
            isOneToOne: false
            referencedRelation: "product_download_files"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_events: {
        Row: {
          amount_cents: number | null
          bundle_id: string | null
          created_at: string
          id: string
          kind: string
          offer_version: string | null
          order_id: string | null
          product_id: string | null
          session_id: string | null
          surface: string
        }
        Insert: {
          amount_cents?: number | null
          bundle_id?: string | null
          created_at?: string
          id?: string
          kind: string
          offer_version?: string | null
          order_id?: string | null
          product_id?: string | null
          session_id?: string | null
          surface: string
        }
        Update: {
          amount_cents?: number | null
          bundle_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          offer_version?: string | null
          order_id?: string | null
          product_id?: string | null
          session_id?: string | null
          surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "merch_events_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "marketplace_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
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
          bundle_id: string | null
          bundle_name: string | null
          created_at: string
          id: string
          is_bump: boolean
          is_preorder_at_purchase: boolean
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
          bundle_id?: string | null
          bundle_name?: string | null
          created_at?: string
          id?: string
          is_bump?: boolean
          is_preorder_at_purchase?: boolean
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
          bundle_id?: string | null
          bundle_name?: string | null
          created_at?: string
          id?: string
          is_bump?: boolean
          is_preorder_at_purchase?: boolean
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
            foreignKeyName: "order_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "marketplace_bundles"
            referencedColumns: ["id"]
          },
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
      payout_requests: {
        Row: {
          admin_note: string | null
          amount_cents: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          id: string
          method_snapshot: Json | null
          seller_id: string
          seller_note: string | null
          seller_payout_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount_cents: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          method_snapshot?: Json | null
          seller_id: string
          seller_note?: string | null
          seller_payout_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          method_snapshot?: Json | null
          seller_id?: string
          seller_note?: string | null
          seller_payout_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_seller_payout_id_fkey"
            columns: ["seller_payout_id"]
            isOneToOne: false
            referencedRelation: "seller_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_download_files: {
        Row: {
          created_at: string
          file_path: string
          file_size_bytes: number | null
          format: string | null
          id: string
          is_primary: boolean
          label: string
          product_id: string
          seller_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size_bytes?: number | null
          format?: string | null
          id?: string
          is_primary?: boolean
          label: string
          product_id: string
          seller_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size_bytes?: number | null
          format?: string | null
          id?: string
          is_primary?: boolean
          label?: string
          product_id?: string
          seller_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_download_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_order_bumps: {
        Row: {
          bump_product_id: string
          created_at: string
          discount_percent: number
          id: string
          is_active: boolean
          product_id: string
          seller_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bump_product_id: string
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          product_id: string
          seller_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bump_product_id?: string
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          product_id?: string
          seller_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_previews: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          page_order: number
          product_id: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          page_order?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          page_order?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_previews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
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
      product_recommendations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          position: number
          product_id: string
          recommended_bundle_id: string | null
          recommended_product_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          position?: number
          product_id: string
          recommended_bundle_id?: string | null
          recommended_product_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          position?: number
          product_id?: string
          recommended_bundle_id?: string | null
          recommended_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recommendations_recommended_bundle_id_fkey"
            columns: ["recommended_bundle_id"]
            isOneToOne: false
            referencedRelation: "marketplace_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recommendations_recommended_product_id_fkey"
            columns: ["recommended_product_id"]
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
      product_subcategories: {
        Row: {
          category_slug: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          category_slug: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          category_slug?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
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
      qr_campaigns: {
        Row: {
          created_at: string
          goal: string | null
          id: string
          name: string
          notes: string | null
          owner_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_projects: {
        Row: {
          campaign_id: string | null
          created_at: string
          destination: string
          destination_type: string
          duplicated_from: string | null
          id: string
          mode: string
          name: string
          niche: string | null
          owner_user_id: string
          placement_label: string | null
          public_id: string
          status: string
          style: Json
          updated_at: string
          use_case: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          destination: string
          destination_type: string
          duplicated_from?: string | null
          id?: string
          mode: string
          name: string
          niche?: string | null
          owner_user_id: string
          placement_label?: string | null
          public_id: string
          status?: string
          style?: Json
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          destination?: string
          destination_type?: string
          duplicated_from?: string | null
          id?: string
          mode?: string
          name?: string
          niche?: string | null
          owner_user_id?: string
          placement_label?: string | null
          public_id?: string
          status?: string
          style?: Json
          updated_at?: string
          use_case?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_projects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "qr_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_projects_duplicated_from_fkey"
            columns: ["duplicated_from"]
            isOneToOne: false
            referencedRelation: "qr_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_events: {
        Row: {
          created_at: string
          device_category: string | null
          id: string
          qr_project_id: string
          referrer_host: string | null
        }
        Insert: {
          created_at?: string
          device_category?: string | null
          id?: string
          qr_project_id: string
          referrer_host?: string | null
        }
        Update: {
          created_at?: string
          device_category?: string | null
          id?: string
          qr_project_id?: string
          referrer_host?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scan_events_qr_project_id_fkey"
            columns: ["qr_project_id"]
            isOneToOne: false
            referencedRelation: "qr_projects"
            referencedColumns: ["id"]
          },
        ]
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
      review_photos: {
        Row: {
          created_at: string
          height: number | null
          id: string
          review_id: string
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          review_id: string
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          review_id?: string
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
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
          campaign: string | null
          campaign_source: string | null
          categories: string[] | null
          country: string | null
          cover_url: string | null
          created_at: string
          creator_lead_id: string | null
          credentials: string[] | null
          extended_bio: string | null
          featured_media_url: string | null
          id: string
          pitch: string
          price_range: string | null
          product_types: string | null
          reapply_after: string | null
          referring_url: string | null
          reviewed_at: string | null
          social_links: Json | null
          status: Database["public"]["Enums"]["application_status"]
          story: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          website: string | null
        }
        Insert: {
          admin_feedback?: string | null
          admin_notes?: string | null
          applicant_email?: string | null
          brand_name: string
          brand_slug?: string | null
          campaign?: string | null
          campaign_source?: string | null
          categories?: string[] | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          creator_lead_id?: string | null
          credentials?: string[] | null
          extended_bio?: string | null
          featured_media_url?: string | null
          id?: string
          pitch: string
          price_range?: string | null
          product_types?: string | null
          reapply_after?: string | null
          referring_url?: string | null
          reviewed_at?: string | null
          social_links?: Json | null
          status?: Database["public"]["Enums"]["application_status"]
          story?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Update: {
          admin_feedback?: string | null
          admin_notes?: string | null
          applicant_email?: string | null
          brand_name?: string
          brand_slug?: string | null
          campaign?: string | null
          campaign_source?: string | null
          categories?: string[] | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          creator_lead_id?: string | null
          credentials?: string[] | null
          extended_bio?: string | null
          featured_media_url?: string | null
          id?: string
          pitch?: string
          price_range?: string | null
          product_types?: string | null
          reapply_after?: string | null
          referring_url?: string | null
          reviewed_at?: string | null
          social_links?: Json | null
          status?: Database["public"]["Enums"]["application_status"]
          story?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_applications_creator_lead_id_fkey"
            columns: ["creator_lead_id"]
            isOneToOne: false
            referencedRelation: "creator_leads"
            referencedColumns: ["id"]
          },
        ]
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
          sequence_step2_sent_at: string | null
          sequence_step3_sent_at: string | null
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
          sequence_step2_sent_at?: string | null
          sequence_step3_sent_at?: string | null
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
          sequence_step2_sent_at?: string | null
          sequence_step3_sent_at?: string | null
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
      vault_finds_products: {
        Row: {
          accent_color: string
          active: boolean
          affiliate_link: string
          created_at: string
          headline: string
          id: string
          image_url: string | null
          sort_order: number
          subtext: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          active?: boolean
          affiliate_link: string
          created_at?: string
          headline: string
          id?: string
          image_url?: string | null
          sort_order?: number
          subtext: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          active?: boolean
          affiliate_link?: string
          created_at?: string
          headline?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          subtext?: string
          updated_at?: string
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
      admin_decide_payout_request: {
        Args: {
          _admin_note?: string
          _approve: boolean
          _mark_paid?: boolean
          _method?: string
          _request_id: string
        }
        Returns: string
      }
      admin_record_seller_payout: {
        Args: {
          _amount_cents: number
          _method?: string
          _note?: string
          _seller_id: string
        }
        Returns: string
      }
      admin_rename_subcategory: {
        Args: { _category_slug: string; _new_name: string; _old_name: string }
        Returns: undefined
      }
      assign_founding_creator: {
        Args: {
          _accepted_by?: string
          _application_id?: string
          _campaign_source?: string
          _lead_id?: string
          _user_id: string
        }
        Returns: number
      }
      brand_slug_normalize: { Args: { _v: string }; Returns: string }
      brand_slugify: { Args: { _name: string }; Returns: string }
      check_creator_lead_rate_limit: {
        Args: { _ip_hash: string; _max_per_hour?: number }
        Returns: boolean
      }
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
      get_creator_follower_count: {
        Args: { _creator_user_id: string }
        Returns: number
      }
      get_creator_referral_stats: { Args: never; Returns: Json }
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
      record_creator_referral: { Args: { _code: string }; Returns: boolean }
      request_payout: {
        Args: { _amount_cents: number; _note?: string }
        Returns: string
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
      academy_difficulty: "beginner" | "intermediate" | "advanced"
      app_role: "admin" | "seller" | "buyer"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "under_review"
        | "info_requested"
      creator_forum_category: "question" | "win" | "feedback"
      creator_forum_status: "pending" | "approved" | "hidden"
      product_category:
        | "ebooks"
        | "courses"
        | "templates"
        | "audio"
        | "leadership"
        | "finance"
        | "purpose"
        | "business"
        | "financial_planners"
        | "ai_prompt_packs"
        | "business_templates"
        | "budget_spreadsheets"
        | "printable_journals"
        | "childrens_educational"
        | "bible_studies"
        | "digital_toolkits"
        | "business_operating_systems"
        | "caption_templates"
        | "film_tv_creator_production"
        | "creator_business_tools"
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
      academy_difficulty: ["beginner", "intermediate", "advanced"],
      app_role: ["admin", "seller", "buyer"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "under_review",
        "info_requested",
      ],
      creator_forum_category: ["question", "win", "feedback"],
      creator_forum_status: ["pending", "approved", "hidden"],
      product_category: [
        "ebooks",
        "courses",
        "templates",
        "audio",
        "leadership",
        "finance",
        "purpose",
        "business",
        "financial_planners",
        "ai_prompt_packs",
        "business_templates",
        "budget_spreadsheets",
        "printable_journals",
        "childrens_educational",
        "bible_studies",
        "digital_toolkits",
        "business_operating_systems",
        "caption_templates",
        "film_tv_creator_production",
        "creator_business_tools",
      ],
      product_license_type: ["personal", "commercial", "extended"],
      product_status: ["draft", "pending", "approved", "rejected"],
    },
  },
} as const
