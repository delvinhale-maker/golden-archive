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
      assurance_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          entity_id: string
          entity_type: string
          id: number
          occurred_at: string
          organization_id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          entity_id: string
          entity_type: string
          id?: never
          occurred_at?: string
          organization_id: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: never
          occurred_at?: string
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assurance_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assurance_memberships: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assurance_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assurance_organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      audiobook_activity_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          job_id: string | null
          owner_id: string
          payload: Json
          project_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          job_id?: string | null
          owner_id: string
          payload?: Json
          project_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string | null
          owner_id?: string
          payload?: Json
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_activity_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audiobook_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_audio_assets: {
        Row: {
          chapter_id: string | null
          checksum_sha256: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number
          id: string
          is_current: boolean
          job_id: string | null
          mime_type: string
          owner_id: string
          project_id: string
          sample_rate: number | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          version: number
        }
        Insert: {
          chapter_id?: string | null
          checksum_sha256?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number
          id?: string
          is_current?: boolean
          job_id?: string | null
          mime_type?: string
          owner_id: string
          project_id: string
          sample_rate?: number | null
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          version?: number
        }
        Update: {
          chapter_id?: string | null
          checksum_sha256?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number
          id?: string
          is_current?: boolean
          job_id?: string | null
          mime_type?: string
          owner_id?: string
          project_id?: string
          sample_rate?: number | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_audio_assets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "audiobook_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_audio_assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audiobook_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_audio_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_chapter_versions: {
        Row: {
          change_note: string | null
          chapter_id: string
          created_at: string
          edited_text: string
          id: string
          is_current: boolean
          owner_id: string
          project_id: string
          updated_at: string
          version: number
        }
        Insert: {
          change_note?: string | null
          chapter_id: string
          created_at?: string
          edited_text: string
          id?: string
          is_current?: boolean
          owner_id: string
          project_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          change_note?: string | null
          chapter_id?: string
          created_at?: string
          edited_text?: string
          id?: string
          is_current?: boolean
          owner_id?: string
          project_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_chapter_versions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "audiobook_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_chapter_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_chapters: {
        Row: {
          chapter_index: number
          char_count: number
          created_at: string
          id: string
          original_text: string
          owner_id: string
          project_id: string
          source_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chapter_index: number
          char_count?: number
          created_at?: string
          id?: string
          original_text: string
          owner_id: string
          project_id: string
          source_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chapter_index?: number
          char_count?: number
          created_at?: string
          id?: string
          original_text?: string
          owner_id?: string
          project_id?: string
          source_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_chapters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_chapters_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "audiobook_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_generation_jobs: {
        Row: {
          attempt: number
          cancelled_at: string | null
          chapter_id: string | null
          chapter_version_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          max_attempts: number
          model: string | null
          owner_id: string
          project_id: string
          provider: string
          queued_at: string
          requested_characters: number
          started_at: string | null
          status: Database["public"]["Enums"]["audiobook_job_status"]
          updated_at: string
          voice_config_id: string | null
        }
        Insert: {
          attempt?: number
          cancelled_at?: string | null
          chapter_id?: string | null
          chapter_version_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          max_attempts?: number
          model?: string | null
          owner_id: string
          project_id: string
          provider?: string
          queued_at?: string
          requested_characters?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["audiobook_job_status"]
          updated_at?: string
          voice_config_id?: string | null
        }
        Update: {
          attempt?: number
          cancelled_at?: string | null
          chapter_id?: string | null
          chapter_version_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          max_attempts?: number
          model?: string | null
          owner_id?: string
          project_id?: string
          provider?: string
          queued_at?: string
          requested_characters?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["audiobook_job_status"]
          updated_at?: string
          voice_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_generation_jobs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "audiobook_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_generation_jobs_chapter_version_id_fkey"
            columns: ["chapter_version_id"]
            isOneToOne: false
            referencedRelation: "audiobook_chapter_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_generation_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_generation_jobs_voice_config_id_fkey"
            columns: ["voice_config_id"]
            isOneToOne: false
            referencedRelation: "audiobook_voice_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_metadata: {
        Row: {
          author_name: string | null
          completeness_score: number
          copyright_year: number | null
          cover_bucket: string
          cover_path: string | null
          created_at: string
          description: string | null
          genre: string | null
          id: string
          is_complete: boolean
          isbn: string | null
          keywords: string[]
          language: string
          narrator_name: string | null
          owner_id: string
          project_id: string
          publisher: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          completeness_score?: number
          copyright_year?: number | null
          cover_bucket?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_complete?: boolean
          isbn?: string | null
          keywords?: string[]
          language?: string
          narrator_name?: string | null
          owner_id: string
          project_id: string
          publisher?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          completeness_score?: number
          copyright_year?: number | null
          cover_bucket?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_complete?: boolean
          isbn?: string | null
          keywords?: string[]
          language?: string
          narrator_name?: string | null
          owner_id?: string
          project_id?: string
          publisher?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_metadata_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_projects: {
        Row: {
          author_name: string | null
          created_at: string
          description: string | null
          id: string
          language: string
          metadata_imported_at: string | null
          owner_id: string
          source_product_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          metadata_imported_at?: string | null
          owner_id: string
          source_product_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          metadata_imported_at?: string | null
          owner_id?: string
          source_product_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_projects_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_pronunciations: {
        Row: {
          created_at: string
          id: string
          ipa: string | null
          notes: string | null
          owner_id: string
          project_id: string
          replacement: string | null
          term: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ipa?: string | null
          notes?: string | null
          owner_id: string
          project_id: string
          replacement?: string | null
          term: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ipa?: string | null
          notes?: string | null
          owner_id?: string
          project_id?: string
          replacement?: string | null
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_pronunciations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_qc_results: {
        Row: {
          check_code: string
          created_at: string
          detail: string | null
          id: string
          metrics: Json
          owner_id: string
          passed: boolean
          qc_run_id: string
          severity: string
        }
        Insert: {
          check_code: string
          created_at?: string
          detail?: string | null
          id?: string
          metrics?: Json
          owner_id: string
          passed?: boolean
          qc_run_id: string
          severity?: string
        }
        Update: {
          check_code?: string
          created_at?: string
          detail?: string | null
          id?: string
          metrics?: Json
          owner_id?: string
          passed?: boolean
          qc_run_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_qc_results_qc_run_id_fkey"
            columns: ["qc_run_id"]
            isOneToOne: false
            referencedRelation: "audiobook_qc_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_qc_runs: {
        Row: {
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          overall_result: string | null
          owner_id: string
          project_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          overall_result?: string | null
          owner_id: string
          project_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          overall_result?: string | null
          owner_id?: string
          project_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_qc_runs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "audiobook_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_qc_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_rights_attestations: {
        Row: {
          attested_at: string | null
          created_at: string
          id: string
          owner_id: string
          project_id: string
          revoked_at: string | null
          statement_text: string | null
          status: Database["public"]["Enums"]["audiobook_attestation_status"]
          updated_at: string
          version: number
        }
        Insert: {
          attested_at?: string | null
          created_at?: string
          id?: string
          owner_id: string
          project_id: string
          revoked_at?: string | null
          statement_text?: string | null
          status?: Database["public"]["Enums"]["audiobook_attestation_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          attested_at?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string
          revoked_at?: string | null
          statement_text?: string | null
          status?: Database["public"]["Enums"]["audiobook_attestation_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_rights_attestations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_sources: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string | null
          owner_id: string
          page_count: number | null
          project_id: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          validation_notes: string | null
          validation_status: string
          word_count: number | null
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          file_name: string
          file_size_bytes?: number
          id?: string
          mime_type?: string | null
          owner_id: string
          page_count?: number | null
          project_id: string
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          validation_notes?: string | null
          validation_status?: string
          word_count?: number | null
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string | null
          owner_id?: string
          page_count?: number | null
          project_id?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          validation_notes?: string | null
          validation_status?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_usage: {
        Row: {
          chapter_id: string | null
          characters: number
          cost_cents: number
          created_at: string
          currency: string
          duration_seconds: number | null
          id: string
          job_id: string | null
          kind: Database["public"]["Enums"]["audiobook_usage_kind"]
          metadata: Json
          model: string | null
          owner_id: string
          project_id: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          characters?: number
          cost_cents?: number
          created_at?: string
          currency?: string
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          kind: Database["public"]["Enums"]["audiobook_usage_kind"]
          metadata?: Json
          model?: string | null
          owner_id: string
          project_id?: string | null
          provider?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          characters?: number
          cost_cents?: number
          created_at?: string
          currency?: string
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          kind?: Database["public"]["Enums"]["audiobook_usage_kind"]
          metadata?: Json
          model?: string | null
          owner_id?: string
          project_id?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_usage_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "audiobook_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audiobook_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiobook_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audiobook_voice_configs: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          model: string | null
          name: string
          owner_id: string
          project_id: string
          provider: string
          settings: Json
          speed: number
          style: string | null
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          model?: string | null
          name?: string
          owner_id: string
          project_id: string
          provider?: string
          settings?: Json
          speed?: number
          style?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          model?: string | null
          name?: string
          owner_id?: string
          project_id?: string
          provider?: string
          settings?: Json
          speed?: number
          style?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_voice_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "audiobook_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aurum_intent_events: {
        Row: {
          analytics_consent: boolean
          category_hints: string[]
          channel: string
          converted: boolean
          created_at: string
          id: string
          objective_key: string
          personalization_consent: boolean
          recommendation_confidence: number | null
          result_count: number
          session_id: string
          stage: string
          user_id: string | null
        }
        Insert: {
          analytics_consent?: boolean
          category_hints?: string[]
          channel: string
          converted?: boolean
          created_at?: string
          id?: string
          objective_key: string
          personalization_consent?: boolean
          recommendation_confidence?: number | null
          result_count?: number
          session_id: string
          stage: string
          user_id?: string | null
        }
        Update: {
          analytics_consent?: boolean
          category_hints?: string[]
          channel?: string
          converted?: boolean
          created_at?: string
          id?: string
          objective_key?: string
          personalization_consent?: boolean
          recommendation_confidence?: number | null
          result_count?: number
          session_id?: string
          stage?: string
          user_id?: string | null
        }
        Relationships: []
      }
      aurum_product_proof: {
        Row: {
          ai_involvement: string | null
          claims_reviewed: boolean
          evidence: Json
          product_id: string
          product_reviewed: boolean
          updated_at: string
          version: string | null
        }
        Insert: {
          ai_involvement?: string | null
          claims_reviewed?: boolean
          evidence?: Json
          product_id: string
          product_reviewed?: boolean
          updated_at?: string
          version?: string | null
        }
        Update: {
          ai_involvement?: string | null
          claims_reviewed?: boolean
          evidence?: Json
          product_id?: string
          product_reviewed?: boolean
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aurum_product_proof_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
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
      canva_design_products: {
        Row: {
          canva_design_id: string
          canva_updated_at: string | null
          created_at: string
          id: string
          imported_at: string
          product_id: string
          source_title: string | null
          sync_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          canva_design_id: string
          canva_updated_at?: string | null
          created_at?: string
          id?: string
          imported_at?: string
          product_id: string
          source_title?: string | null
          sync_state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          canva_design_id?: string
          canva_updated_at?: string | null
          created_at?: string
          id?: string
          imported_at?: string
          product_id?: string
          source_title?: string | null
          sync_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canva_design_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
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
      creator_studio_assets: {
        Row: {
          byte_size: number
          category: string
          created_at: string
          height: number | null
          id: string
          metadata: Json
          mime_type: string
          original_filename: string
          owner_user_id: string
          state: string
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          byte_size: number
          category: string
          created_at?: string
          height?: number | null
          id: string
          metadata?: Json
          mime_type: string
          original_filename: string
          owner_user_id: string
          state?: string
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          byte_size?: number
          category?: string
          created_at?: string
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          original_filename?: string
          owner_user_id?: string
          state?: string
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      creator_studio_billing_state: {
        Row: {
          created_at: string
          last_event_created: string | null
          owner_user_id: string
          stripe_customer_id: string | null
          stripe_environment: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_event_created?: string | null
          owner_user_id: string
          stripe_customer_id?: string | null
          stripe_environment: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_event_created?: string | null
          owner_user_id?: string
          stripe_customer_id?: string | null
          stripe_environment?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creator_studio_entitlements: {
        Row: {
          billing_status: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          owner_user_id: string
          plan_key: string
          updated_at: string
        }
        Insert: {
          billing_status?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          owner_user_id: string
          plan_key?: string
          updated_at?: string
        }
        Update: {
          billing_status?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          owner_user_id?: string
          plan_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_studio_events: {
        Row: {
          created_at: string
          entity_id: string | null
          event_type: string
          id: string
          metadata: Json
          owner_user_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          owner_user_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          owner_user_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creator_studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_studio_extra_video_credits: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          quantity_purchased: number
          quantity_remaining: number
          stripe_checkout_session_id: string
          stripe_environment: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          quantity_purchased: number
          quantity_remaining: number
          stripe_checkout_session_id: string
          stripe_environment: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          quantity_purchased?: number
          quantity_remaining?: number
          stripe_checkout_session_id?: string
          stripe_environment?: string
        }
        Relationships: []
      }
      creator_studio_project_assets: {
        Row: {
          asset_id: string
          created_at: string
          owner_user_id: string
          project_id: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          owner_user_id: string
          project_id: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          owner_user_id?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_project_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "creator_studio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_studio_project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creator_studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_studio_projects: {
        Row: {
          aspect_ratio: string
          created_at: string
          cta: string | null
          currency: string
          destination_url: string | null
          duration_seconds: number
          hook: string | null
          id: string
          metadata: Json
          owner_user_id: string
          price_cents: number | null
          product_title: string | null
          project_type: string
          source_product_id: string | null
          status: string
          style_key: string
          title: string
          updated_at: string
          wizard_step: number
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          cta?: string | null
          currency?: string
          destination_url?: string | null
          duration_seconds?: number
          hook?: string | null
          id?: string
          metadata?: Json
          owner_user_id: string
          price_cents?: number | null
          product_title?: string | null
          project_type: string
          source_product_id?: string | null
          status?: string
          style_key?: string
          title?: string
          updated_at?: string
          wizard_step?: number
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          cta?: string | null
          currency?: string
          destination_url?: string | null
          duration_seconds?: number
          hook?: string | null
          id?: string
          metadata?: Json
          owner_user_id?: string
          price_cents?: number | null
          product_title?: string | null
          project_type?: string
          source_product_id?: string | null
          status?: string
          style_key?: string
          title?: string
          updated_at?: string
          wizard_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_projects_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_studio_provider_state: {
        Row: {
          callback_secret_hash: string
          last_checked_at: string | null
          provider_metadata: Json
          provider_output_url: string | null
          provider_status: string | null
          render_job_id: string
          updated_at: string
        }
        Insert: {
          callback_secret_hash: string
          last_checked_at?: string | null
          provider_metadata?: Json
          provider_output_url?: string | null
          provider_status?: string | null
          render_job_id: string
          updated_at?: string
        }
        Update: {
          callback_secret_hash?: string
          last_checked_at?: string | null
          provider_metadata?: Json
          provider_output_url?: string | null
          provider_status?: string | null
          render_job_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_provider_state_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: true
            referencedRelation: "creator_studio_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_studio_render_jobs: {
        Row: {
          actual_cost_cents: number | null
          attempt_count: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          estimated_cost_cents: number
          id: string
          idempotency_key: string
          output_storage_path: string | null
          owner_user_id: string
          project_id: string
          provider: string
          provider_job_id: string | null
          quality: string
          requested_duration_seconds: number
          safe_error_message: string | null
          started_at: string | null
          status: string
          template_version: string
          timeout_at: string | null
          updated_at: string
        }
        Insert: {
          actual_cost_cents?: number | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_cents?: number
          id?: string
          idempotency_key: string
          output_storage_path?: string | null
          owner_user_id: string
          project_id: string
          provider?: string
          provider_job_id?: string | null
          quality: string
          requested_duration_seconds: number
          safe_error_message?: string | null
          started_at?: string | null
          status?: string
          template_version: string
          timeout_at?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost_cents?: number | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_cents?: number
          id?: string
          idempotency_key?: string
          output_storage_path?: string | null
          owner_user_id?: string
          project_id?: string
          provider?: string
          provider_job_id?: string | null
          quality?: string
          requested_duration_seconds?: number
          safe_error_message?: string | null
          started_at?: string | null
          status?: string
          template_version?: string
          timeout_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_render_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creator_studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_studio_runtime_control: {
        Row: {
          circuit_open_until: string | null
          consecutive_provider_failures: number
          estimated_cost_cents_per_minute: number
          failure_window_started_at: string | null
          max_attempts: number
          max_concurrent_per_user: number
          max_output_bytes: number
          rendering_enabled: boolean
          singleton: boolean
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          circuit_open_until?: string | null
          consecutive_provider_failures?: number
          estimated_cost_cents_per_minute?: number
          failure_window_started_at?: string | null
          max_attempts?: number
          max_concurrent_per_user?: number
          max_output_bytes?: number
          rendering_enabled?: boolean
          singleton?: boolean
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          circuit_open_until?: string | null
          consecutive_provider_failures?: number
          estimated_cost_cents_per_minute?: number
          failure_window_started_at?: string | null
          max_attempts?: number
          max_concurrent_per_user?: number
          max_output_bytes?: number
          rendering_enabled?: boolean
          singleton?: boolean
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      creator_studio_stripe_events: {
        Row: {
          event_created: string
          event_type: string
          owner_user_id: string | null
          processed_at: string
          stripe_environment: string
          stripe_event_id: string
        }
        Insert: {
          event_created: string
          event_type: string
          owner_user_id?: string | null
          processed_at?: string
          stripe_environment: string
          stripe_event_id: string
        }
        Update: {
          event_created?: string
          event_type?: string
          owner_user_id?: string | null
          processed_at?: string
          stripe_environment?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      creator_studio_usage_reservations: {
        Row: {
          consumed_at: string | null
          extra_credit_id: string | null
          id: string
          owner_user_id: string
          period_end: string | null
          period_start: string | null
          plan_key: string
          released_at: string | null
          render_job_id: string
          reserved_at: string
          source: string
          state: string
        }
        Insert: {
          consumed_at?: string | null
          extra_credit_id?: string | null
          id?: string
          owner_user_id: string
          period_end?: string | null
          period_start?: string | null
          plan_key: string
          released_at?: string | null
          render_job_id: string
          reserved_at?: string
          source: string
          state?: string
        }
        Update: {
          consumed_at?: string | null
          extra_credit_id?: string | null
          id?: string
          owner_user_id?: string
          period_end?: string | null
          period_start?: string | null
          plan_key?: string
          released_at?: string | null
          render_job_id?: string
          reserved_at?: string
          source?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_studio_usage_reservations_extra_credit_id_fkey"
            columns: ["extra_credit_id"]
            isOneToOne: false
            referencedRelation: "creator_studio_extra_video_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_studio_usage_reservations_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: true
            referencedRelation: "creator_studio_render_jobs"
            referencedColumns: ["id"]
          },
        ]
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
      food_corrective_actions: {
        Row: {
          action: string
          created_at: string
          due_at: string | null
          exception_id: string | null
          id: string
          organization_id: string
          owner_id: string | null
          recall_id: string | null
          status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          due_at?: string | null
          exception_id?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          recall_id?: string | null
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          due_at?: string | null
          exception_id?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          recall_id?: string | null
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_corrective_actions_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_corrective_actions_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "food_recall_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      food_event_kdes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          kde_key: string
          kde_value: string | null
          organization_id: string
          required: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          kde_key: string
          kde_value?: string | null
          organization_id: string
          required?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          kde_key?: string
          kde_value?: string | null
          organization_id?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "food_event_kdes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_event_kdes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_evidence: {
        Row: {
          corrective_action_id: string | null
          created_at: string
          evidence_type: string
          external_reference: string | null
          id: string
          organization_id: string
          sha256: string | null
          storage_path: string | null
          uploaded_by: string
          version: number
        }
        Insert: {
          corrective_action_id?: string | null
          created_at?: string
          evidence_type: string
          external_reference?: string | null
          id?: string
          organization_id: string
          sha256?: string | null
          storage_path?: string | null
          uploaded_by: string
          version?: number
        }
        Update: {
          corrective_action_id?: string | null
          created_at?: string
          evidence_type?: string
          external_reference?: string | null
          id?: string
          organization_id?: string
          sha256?: string | null
          storage_path?: string | null
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_evidence_corrective_action_id_fkey"
            columns: ["corrective_action_id"]
            isOneToOne: false
            referencedRelation: "food_corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_facilities: {
        Row: {
          active: boolean
          address: Json
          created_at: string
          facility_type: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          active?: boolean
          address?: Json
          created_at?: string
          facility_type?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          active?: boolean
          address?: Json
          created_at?: string
          facility_type?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          created_at: string
          description: string | null
          ftl_applicable: boolean | null
          ftl_basis: string | null
          id: string
          name: string
          organization_id: string
          sku: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ftl_applicable?: boolean | null
          ftl_basis?: string | null
          id?: string
          name: string
          organization_id: string
          sku?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ftl_applicable?: boolean | null
          ftl_basis?: string | null
          id?: string
          name?: string
          organization_id?: string
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_lot_relationships: {
        Row: {
          child_lot_id: string
          created_at: string
          id: string
          organization_id: string
          parent_lot_id: string
          relationship_type: string
        }
        Insert: {
          child_lot_id: string
          created_at?: string
          id?: string
          organization_id: string
          parent_lot_id: string
          relationship_type?: string
        }
        Update: {
          child_lot_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          parent_lot_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_lot_relationships_child_lot_id_fkey"
            columns: ["child_lot_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_lot_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_lot_relationships_parent_lot_id_fkey"
            columns: ["parent_lot_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      food_mock_record_requests: {
        Row: {
          completed_at: string | null
          completeness_percent: number | null
          created_by: string
          deadline_at: string
          id: string
          lot_id: string | null
          missing_requirements: Json
          organization_id: string
          requested_at: string
          result: string | null
        }
        Insert: {
          completed_at?: string | null
          completeness_percent?: number | null
          created_by: string
          deadline_at: string
          id?: string
          lot_id?: string | null
          missing_requirements?: Json
          organization_id: string
          requested_at?: string
          result?: string | null
        }
        Update: {
          completed_at?: string | null
          completeness_percent?: number | null
          created_by?: string
          deadline_at?: string
          id?: string
          lot_id?: string | null
          missing_requirements?: Json
          organization_id?: string
          requested_at?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_mock_record_requests_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_mock_record_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_recall_cases: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          initiated_at: string | null
          organization_id: string
          reason: string
          status: string
          title: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          initiated_at?: string | null
          organization_id: string
          reason: string
          status?: string
          title: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          initiated_at?: string | null
          organization_id?: string
          reason?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_recall_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_recall_scope_items: {
        Row: {
          lot_id: string
          recall_id: string
          scope_reason: string | null
        }
        Insert: {
          lot_id: string
          recall_id: string
          scope_reason?: string | null
        }
        Update: {
          lot_id?: string
          recall_id?: string
          scope_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_recall_scope_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_recall_scope_items_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "food_recall_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      food_traceability_events: {
        Row: {
          created_at: string
          created_by: string
          event_time: string
          event_type: string
          facility_id: string | null
          id: string
          lot_id: string
          organization_id: string
          reference_document: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          event_time: string
          event_type: string
          facility_id?: string | null
          id?: string
          lot_id: string
          organization_id: string
          reference_document?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          event_time?: string
          event_type?: string
          facility_id?: string | null
          id?: string
          lot_id?: string
          organization_id?: string
          reference_document?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_traceability_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "food_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_traceability_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_traceability_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_traceability_exceptions: {
        Row: {
          created_at: string
          details: string | null
          due_at: string | null
          event_id: string | null
          id: string
          lot_id: string | null
          organization_id: string
          owner_id: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          lot_id?: string | null
          organization_id: string
          owner_id?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          details?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          lot_id?: string | null
          organization_id?: string
          owner_id?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_traceability_exceptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_traceability_exceptions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "food_traceability_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_traceability_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_traceability_lots: {
        Row: {
          created_at: string
          expiration_date: string | null
          facility_id: string | null
          id: string
          item_id: string
          lot_code: string
          organization_id: string
          production_date: string | null
          quantity: number | null
          status: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          facility_id?: string | null
          id?: string
          item_id: string
          lot_code: string
          organization_id: string
          production_date?: string | null
          quantity?: number | null
          status?: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          facility_id?: string | null
          id?: string
          item_id?: string
          lot_code?: string
          organization_id?: string
          production_date?: string | null
          quantity?: number | null
          status?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_traceability_lots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "food_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_traceability_lots_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_traceability_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_trading_partners: {
        Row: {
          active: boolean
          contact: Json
          created_at: string
          id: string
          name: string
          organization_id: string
          partner_type: string
        }
        Insert: {
          active?: boolean
          contact?: Json
          created_at?: string
          id?: string
          name: string
          organization_id: string
          partner_type?: string
        }
        Update: {
          active?: boolean
          contact?: Json
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          partner_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_trading_partners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "assurance_organizations"
            referencedColumns: ["id"]
          },
        ]
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
      insider_editions: {
        Row: {
          audience_type: string
          body_md: string
          created_at: string
          created_by: string | null
          id: string
          is_public: boolean
          preview_text: string | null
          published_at: string | null
          recipients_count: number
          sent_at: string | null
          slug: string
          status: string
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          audience_type?: string
          body_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          preview_text?: string | null
          published_at?: string | null
          recipients_count?: number
          sent_at?: string | null
          slug: string
          status?: string
          subject: string
          title: string
          updated_at?: string
        }
        Update: {
          audience_type?: string
          body_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          preview_text?: string | null
          published_at?: string | null
          recipients_count?: number
          sent_at?: string | null
          slug?: string
          status?: string
          subject?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_connections: {
        Row: {
          access_token_enc: Json | null
          access_token_expires_at: string | null
          code_verifier_enc: Json | null
          created_at: string
          external_account_id: string | null
          external_display_name: string | null
          id: string
          last_connected_at: string | null
          last_error: string | null
          metadata: Json
          oauth_state: string | null
          provider: string
          refresh_token_enc: Json | null
          refresh_version: number
          scopes: string[]
          state_expires_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: Json | null
          access_token_expires_at?: string | null
          code_verifier_enc?: Json | null
          created_at?: string
          external_account_id?: string | null
          external_display_name?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          metadata?: Json
          oauth_state?: string | null
          provider: string
          refresh_token_enc?: Json | null
          refresh_version?: number
          scopes?: string[]
          state_expires_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: Json | null
          access_token_expires_at?: string | null
          code_verifier_enc?: Json | null
          created_at?: string
          external_account_id?: string | null
          external_display_name?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          metadata?: Json
          oauth_state?: string | null
          provider?: string
          refresh_token_enc?: Json | null
          refresh_version?: number
          scopes?: string[]
          state_expires_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      license_wallet_activity: {
        Row: {
          action: string
          created_at: string
          detail: Json
          document_id: string | null
          id: string
          owner_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          document_id?: string | null
          id?: string
          owner_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          document_id?: string | null
          id?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_wallet_activity_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "license_wallet_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      license_wallet_billing_events: {
        Row: {
          environment: string
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          environment?: string
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          environment?: string
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      license_wallet_documents: {
        Row: {
          category: string
          created_at: string
          doc_number: string | null
          expiration_date: string | null
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          issue_date: string | null
          issuer: string | null
          location_id: string | null
          no_expiration: boolean
          notes: string | null
          owner_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          doc_number?: string | null
          expiration_date?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          location_id?: string | null
          no_expiration?: boolean
          notes?: string | null
          owner_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          doc_number?: string | null
          expiration_date?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          location_id?: string | null
          no_expiration?: boolean
          notes?: string | null
          owner_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_wallet_documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "license_wallet_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      license_wallet_entitlements: {
        Row: {
          created_at: string
          current_period_end: string | null
          environment: string
          plan: string
          price_lookup_key: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          environment?: string
          plan?: string
          price_lookup_key?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          environment?: string
          plan?: string
          price_lookup_key?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      license_wallet_locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      license_wallet_reminder_log: {
        Row: {
          created_at: string
          document_id: string
          id: string
          offset_days: number
          owner_user_id: string
          recipient_email: string | null
          reminder_for_date: string
          sent_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          offset_days: number
          owner_user_id: string
          recipient_email?: string | null
          reminder_for_date: string
          sent_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          offset_days?: number
          owner_user_id?: string
          recipient_email?: string | null
          reminder_for_date?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_wallet_reminder_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "license_wallet_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      license_wallet_reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean
          offsets: number[]
          owner_user_id: string
          recipient_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          offsets?: number[]
          owner_user_id: string
          recipient_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          offsets?: number[]
          owner_user_id?: string
          recipient_email?: string | null
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
          seo_description: string | null
          seo_focus_keyword: string | null
          seo_image_alt: string | null
          seo_og_description: string | null
          seo_og_title: string | null
          seo_robots_follow: boolean
          seo_robots_index: boolean
          seo_secondary_keywords: string[]
          seo_title: string | null
          seo_updated_at: string | null
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
          seo_description?: string | null
          seo_focus_keyword?: string | null
          seo_image_alt?: string | null
          seo_og_description?: string | null
          seo_og_title?: string | null
          seo_robots_follow?: boolean
          seo_robots_index?: boolean
          seo_secondary_keywords?: string[]
          seo_title?: string | null
          seo_updated_at?: string | null
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
          seo_description?: string | null
          seo_focus_keyword?: string | null
          seo_image_alt?: string | null
          seo_og_description?: string | null
          seo_og_title?: string | null
          seo_robots_follow?: boolean
          seo_robots_index?: boolean
          seo_secondary_keywords?: string[]
          seo_title?: string | null
          seo_updated_at?: string | null
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
      product_slug_redirects: {
        Row: {
          created_at: string
          old_slug: string
          old_slug_key: string
          product_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          old_slug: string
          old_slug_key?: string
          product_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          old_slug?: string
          old_slug_key?: string
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_slug_redirects_product_id_fkey"
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
      rights_ai_consents: {
        Row: {
          asset_id: string | null
          attribution_required: boolean
          compensation_rule: string | null
          created_at: string
          derived_model_allowed: boolean
          evidence_reference: string | null
          human_output_approval_required: boolean
          id: string
          license_contact: string | null
          model_retention_allowed: boolean
          notes: string | null
          owner_user_id: string
          passport_key: string
          permission: Database["public"]["Enums"]["rights_permission"]
          revocation_rule: string | null
          separate_written_consent_required: boolean
          term: string | null
          territory: string | null
          updated_at: string
          use_case: Database["public"]["Enums"]["rights_ai_use_case"]
        }
        Insert: {
          asset_id?: string | null
          attribution_required?: boolean
          compensation_rule?: string | null
          created_at?: string
          derived_model_allowed?: boolean
          evidence_reference?: string | null
          human_output_approval_required?: boolean
          id?: string
          license_contact?: string | null
          model_retention_allowed?: boolean
          notes?: string | null
          owner_user_id: string
          passport_key: string
          permission: Database["public"]["Enums"]["rights_permission"]
          revocation_rule?: string | null
          separate_written_consent_required?: boolean
          term?: string | null
          territory?: string | null
          updated_at?: string
          use_case: Database["public"]["Enums"]["rights_ai_use_case"]
        }
        Update: {
          asset_id?: string | null
          attribution_required?: boolean
          compensation_rule?: string | null
          created_at?: string
          derived_model_allowed?: boolean
          evidence_reference?: string | null
          human_output_approval_required?: boolean
          id?: string
          license_contact?: string | null
          model_retention_allowed?: boolean
          notes?: string | null
          owner_user_id?: string
          passport_key?: string
          permission?: Database["public"]["Enums"]["rights_permission"]
          revocation_rule?: string | null
          separate_written_consent_required?: boolean
          term?: string | null
          territory?: string | null
          updated_at?: string
          use_case?: Database["public"]["Enums"]["rights_ai_use_case"]
        }
        Relationships: [
          {
            foreignKeyName: "rights_ai_consents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_analysis_findings: {
        Row: {
          analysis_run_id: string
          applied_entity_id: string | null
          applied_entity_type: string | null
          confidence: number
          created_at: string
          document_id: string
          edited_value: Json | null
          field: string
          finding_key: string
          id: string
          normalized_value: Json | null
          owner_user_id: string
          pass_type: Database["public"]["Enums"]["rights_analysis_pass_type"]
          passport_key: string
          raw_value: string | null
          review_reason: string | null
          review_required: boolean
          review_status: Database["public"]["Enums"]["rights_finding_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          source: Json | null
          suggested_target: Json | null
          updated_at: string
        }
        Insert: {
          analysis_run_id: string
          applied_entity_id?: string | null
          applied_entity_type?: string | null
          confidence?: number
          created_at?: string
          document_id: string
          edited_value?: Json | null
          field: string
          finding_key: string
          id?: string
          normalized_value?: Json | null
          owner_user_id: string
          pass_type: Database["public"]["Enums"]["rights_analysis_pass_type"]
          passport_key: string
          raw_value?: string | null
          review_reason?: string | null
          review_required?: boolean
          review_status?: Database["public"]["Enums"]["rights_finding_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Json | null
          suggested_target?: Json | null
          updated_at?: string
        }
        Update: {
          analysis_run_id?: string
          applied_entity_id?: string | null
          applied_entity_type?: string | null
          confidence?: number
          created_at?: string
          document_id?: string
          edited_value?: Json | null
          field?: string
          finding_key?: string
          id?: string
          normalized_value?: Json | null
          owner_user_id?: string
          pass_type?: Database["public"]["Enums"]["rights_analysis_pass_type"]
          passport_key?: string
          raw_value?: string | null
          review_reason?: string | null
          review_required?: boolean
          review_status?: Database["public"]["Enums"]["rights_finding_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Json | null
          suggested_target?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rights_analysis_findings_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "rights_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rights_analysis_findings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_analysis_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          document_id: string
          error_code: string | null
          id: string
          model: string | null
          owner_user_id: string
          pass_status: Json
          passport_key: string
          provider: string
          schema_version: string
          started_at: string | null
          status: Database["public"]["Enums"]["rights_analysis_run_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_id: string
          error_code?: string | null
          id?: string
          model?: string | null
          owner_user_id: string
          pass_status?: Json
          passport_key: string
          provider?: string
          schema_version?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["rights_analysis_run_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error_code?: string | null
          id?: string
          model?: string | null
          owner_user_id?: string
          pass_status?: Json
          passport_key?: string
          provider?: string
          schema_version?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["rights_analysis_run_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rights_analysis_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_evidence: {
        Row: {
          asset_id: string
          copyright_trademark_reference: string | null
          created_at: string
          credential_manifest_reference: string | null
          evidence_type: Database["public"]["Enums"]["rights_evidence_type"]
          file_url: string | null
          has_content_credential: boolean
          hash_fingerprint: string | null
          id: string
          identity_evidence_reference: string | null
          issued_date: string | null
          notes: string | null
          owner_user_id: string
          passport_key: string
          source_creator: string | null
          status: Database["public"]["Enums"]["rights_evidence_status"]
          updated_at: string
          verification_date: string | null
          verified_by: string | null
        }
        Insert: {
          asset_id: string
          copyright_trademark_reference?: string | null
          created_at?: string
          credential_manifest_reference?: string | null
          evidence_type: Database["public"]["Enums"]["rights_evidence_type"]
          file_url?: string | null
          has_content_credential?: boolean
          hash_fingerprint?: string | null
          id?: string
          identity_evidence_reference?: string | null
          issued_date?: string | null
          notes?: string | null
          owner_user_id: string
          passport_key: string
          source_creator?: string | null
          status?: Database["public"]["Enums"]["rights_evidence_status"]
          updated_at?: string
          verification_date?: string | null
          verified_by?: string | null
        }
        Update: {
          asset_id?: string
          copyright_trademark_reference?: string | null
          created_at?: string
          credential_manifest_reference?: string | null
          evidence_type?: Database["public"]["Enums"]["rights_evidence_type"]
          file_url?: string | null
          has_content_credential?: boolean
          hash_fingerprint?: string | null
          id?: string
          identity_evidence_reference?: string | null
          issued_date?: string | null
          notes?: string | null
          owner_user_id?: string
          passport_key?: string
          source_creator?: string | null
          status?: Database["public"]["Enums"]["rights_evidence_status"]
          updated_at?: string
          verification_date?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rights_evidence_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_licenses: {
        Row: {
          ai_synthetic_rights_included: boolean | null
          asset_id: string
          compensation: string | null
          controlling_document_reference: string | null
          created_at: string
          end_date: string | null
          exact_use: string | null
          id: string
          is_exclusive: boolean
          licensee: string
          notes: string | null
          owner_user_id: string
          passport_key: string
          permission_type: Database["public"]["Enums"]["rights_license_permission_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["rights_license_status"]
          territory: string | null
          updated_at: string
        }
        Insert: {
          ai_synthetic_rights_included?: boolean | null
          asset_id: string
          compensation?: string | null
          controlling_document_reference?: string | null
          created_at?: string
          end_date?: string | null
          exact_use?: string | null
          id?: string
          is_exclusive?: boolean
          licensee: string
          notes?: string | null
          owner_user_id: string
          passport_key: string
          permission_type?: Database["public"]["Enums"]["rights_license_permission_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["rights_license_status"]
          territory?: string | null
          updated_at?: string
        }
        Update: {
          ai_synthetic_rights_included?: boolean | null
          asset_id?: string
          compensation?: string | null
          controlling_document_reference?: string | null
          created_at?: string
          end_date?: string | null
          exact_use?: string | null
          id?: string
          is_exclusive?: boolean
          licensee?: string
          notes?: string | null
          owner_user_id?: string
          passport_key?: string
          permission_type?: Database["public"]["Enums"]["rights_license_permission_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["rights_license_status"]
          territory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rights_licenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_passport_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["rights_asset_type"]
          claimed_owner_controller: string | null
          control_basis: Database["public"]["Enums"]["rights_control_basis"]
          created_at: string
          default_ai_policy: Database["public"]["Enums"]["rights_ai_policy"]
          default_license_policy: string | null
          description: string | null
          evidence_location: string | null
          expiry_date: string | null
          id: string
          is_public: boolean
          name: string
          notes: string | null
          owner_user_id: string
          passport_key: string
          registration_identifier: string | null
          representative: string | null
          status: Database["public"]["Enums"]["rights_asset_status"]
          territory: string | null
          updated_at: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["rights_asset_type"]
          claimed_owner_controller?: string | null
          control_basis?: Database["public"]["Enums"]["rights_control_basis"]
          created_at?: string
          default_ai_policy?: Database["public"]["Enums"]["rights_ai_policy"]
          default_license_policy?: string | null
          description?: string | null
          evidence_location?: string | null
          expiry_date?: string | null
          id?: string
          is_public?: boolean
          name: string
          notes?: string | null
          owner_user_id: string
          passport_key: string
          registration_identifier?: string | null
          representative?: string | null
          status?: Database["public"]["Enums"]["rights_asset_status"]
          territory?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["rights_asset_type"]
          claimed_owner_controller?: string | null
          control_basis?: Database["public"]["Enums"]["rights_control_basis"]
          created_at?: string
          default_ai_policy?: Database["public"]["Enums"]["rights_ai_policy"]
          default_license_policy?: string | null
          description?: string | null
          evidence_location?: string | null
          expiry_date?: string | null
          id?: string
          is_public?: boolean
          name?: string
          notes?: string | null
          owner_user_id?: string
          passport_key?: string
          registration_identifier?: string | null
          representative?: string | null
          status?: Database["public"]["Enums"]["rights_asset_status"]
          territory?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rights_passport_documents: {
        Row: {
          analysis_status: Database["public"]["Enums"]["rights_analysis_status"]
          analyzed_at: string | null
          created_at: string
          document_type: Database["public"]["Enums"]["rights_document_type"]
          error_code: string | null
          error_message_safe: string | null
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          original_file_name: string
          owner_user_id: string
          page_count: number | null
          parse_status: Database["public"]["Enums"]["rights_parse_status"]
          parsed_at: string | null
          parsed_content: Json | null
          passport_key: string
          status: Database["public"]["Enums"]["rights_document_status"]
          storage_path: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          analysis_status?: Database["public"]["Enums"]["rights_analysis_status"]
          analyzed_at?: string | null
          created_at?: string
          document_type?: Database["public"]["Enums"]["rights_document_type"]
          error_code?: string | null
          error_message_safe?: string | null
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          original_file_name: string
          owner_user_id: string
          page_count?: number | null
          parse_status?: Database["public"]["Enums"]["rights_parse_status"]
          parsed_at?: string | null
          parsed_content?: Json | null
          passport_key: string
          status?: Database["public"]["Enums"]["rights_document_status"]
          storage_path: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          analysis_status?: Database["public"]["Enums"]["rights_analysis_status"]
          analyzed_at?: string | null
          created_at?: string
          document_type?: Database["public"]["Enums"]["rights_document_type"]
          error_code?: string | null
          error_message_safe?: string | null
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          original_file_name?: string
          owner_user_id?: string
          page_count?: number | null
          parse_status?: Database["public"]["Enums"]["rights_parse_status"]
          parsed_at?: string | null
          parsed_content?: Json | null
          passport_key?: string
          status?: Database["public"]["Enums"]["rights_document_status"]
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      rights_passport_entitlements: {
        Row: {
          created_at: string
          plan: Database["public"]["Enums"]["rights_passport_plan"]
          source_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plan?: Database["public"]["Enums"]["rights_passport_plan"]
          source_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          plan?: Database["public"]["Enums"]["rights_passport_plan"]
          source_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rights_passport_events: {
        Row: {
          created_at: string
          detail: Json | null
          id: string
          kind: string
          owner_user_id: string
          passport_key: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          id?: string
          kind: string
          owner_user_id: string
          passport_key?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          id?: string
          kind?: string
          owner_user_id?: string
          passport_key?: string | null
        }
        Relationships: []
      }
      rights_passport_public_identities: {
        Row: {
          created_at: string
          owner_user_id: string
          passport_key: string
          public_id: string
        }
        Insert: {
          created_at?: string
          owner_user_id: string
          passport_key: string
          public_id: string
        }
        Update: {
          created_at?: string
          owner_user_id?: string
          passport_key?: string
          public_id?: string
        }
        Relationships: []
      }
      rights_passport_snapshots: {
        Row: {
          content_hash: string
          created_at: string
          effective_at: string | null
          id: string
          owner_user_id: string
          passport_key: string
          passport_version: number
          private_snapshot_metadata: Json | null
          public_id: string
          public_payload: Json
          published_at: string
          revoked_at: string | null
          schema_version: string
          source_passport_id: string
          status: Database["public"]["Enums"]["rights_snapshot_status"]
          supersedes_snapshot_id: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          effective_at?: string | null
          id?: string
          owner_user_id: string
          passport_key: string
          passport_version: number
          private_snapshot_metadata?: Json | null
          public_id: string
          public_payload: Json
          published_at?: string
          revoked_at?: string | null
          schema_version?: string
          source_passport_id: string
          status?: Database["public"]["Enums"]["rights_snapshot_status"]
          supersedes_snapshot_id?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          effective_at?: string | null
          id?: string
          owner_user_id?: string
          passport_key?: string
          passport_version?: number
          private_snapshot_metadata?: Json | null
          public_id?: string
          public_payload?: Json
          published_at?: string
          revoked_at?: string | null
          schema_version?: string
          source_passport_id?: string
          status?: Database["public"]["Enums"]["rights_snapshot_status"]
          supersedes_snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rights_passport_snapshots_public_id_fkey"
            columns: ["public_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_public_identities"
            referencedColumns: ["public_id"]
          },
          {
            foreignKeyName: "rights_passport_snapshots_source_passport_id_fkey"
            columns: ["source_passport_id"]
            isOneToOne: false
            referencedRelation: "rights_passports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rights_passport_snapshots_supersedes_snapshot_id_fkey"
            columns: ["supersedes_snapshot_id"]
            isOneToOne: false
            referencedRelation: "rights_passport_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_passports: {
        Row: {
          agent_manager_contact: string | null
          agent_manager_name: string | null
          created_at: string
          effective_date: string | null
          id: string
          jurisdiction: string | null
          legal_name: string | null
          owner_user_id: string
          passport_key: string
          previous_version_id: string | null
          primary_role: string | null
          private_notes: string | null
          public_notes: string | null
          public_professional_name: string | null
          public_rights_url: string | null
          representative_contact: string | null
          representative_name: string | null
          review_frequency: string | null
          rights_contact_email: string | null
          rights_entity: string | null
          stage_brand_name: string | null
          status: Database["public"]["Enums"]["rights_passport_status"]
          successor_estate_contact: string | null
          updated_at: string
          verification_level: Database["public"]["Enums"]["rights_verification_level"]
          version: number
        }
        Insert: {
          agent_manager_contact?: string | null
          agent_manager_name?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          jurisdiction?: string | null
          legal_name?: string | null
          owner_user_id: string
          passport_key?: string
          previous_version_id?: string | null
          primary_role?: string | null
          private_notes?: string | null
          public_notes?: string | null
          public_professional_name?: string | null
          public_rights_url?: string | null
          representative_contact?: string | null
          representative_name?: string | null
          review_frequency?: string | null
          rights_contact_email?: string | null
          rights_entity?: string | null
          stage_brand_name?: string | null
          status?: Database["public"]["Enums"]["rights_passport_status"]
          successor_estate_contact?: string | null
          updated_at?: string
          verification_level?: Database["public"]["Enums"]["rights_verification_level"]
          version?: number
        }
        Update: {
          agent_manager_contact?: string | null
          agent_manager_name?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          jurisdiction?: string | null
          legal_name?: string | null
          owner_user_id?: string
          passport_key?: string
          previous_version_id?: string | null
          primary_role?: string | null
          private_notes?: string | null
          public_notes?: string | null
          public_professional_name?: string | null
          public_rights_url?: string | null
          representative_contact?: string | null
          representative_name?: string | null
          review_frequency?: string | null
          rights_contact_email?: string | null
          rights_entity?: string | null
          stage_brand_name?: string | null
          status?: Database["public"]["Enums"]["rights_passport_status"]
          successor_estate_contact?: string | null
          updated_at?: string
          verification_level?: Database["public"]["Enums"]["rights_verification_level"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rights_passports_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "rights_passports"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_review_flags: {
        Row: {
          affected_entity_id: string | null
          affected_entity_type: string
          created_at: string
          description: string
          evidence_context: string | null
          id: string
          owner_user_id: string
          passport_key: string
          recommended_action: string | null
          resolved_at: string | null
          rule_code: string
          severity: Database["public"]["Enums"]["rights_flag_severity"]
          status: Database["public"]["Enums"]["rights_flag_status"]
          title: string
          updated_at: string
        }
        Insert: {
          affected_entity_id?: string | null
          affected_entity_type: string
          created_at?: string
          description: string
          evidence_context?: string | null
          id?: string
          owner_user_id: string
          passport_key: string
          recommended_action?: string | null
          resolved_at?: string | null
          rule_code: string
          severity: Database["public"]["Enums"]["rights_flag_severity"]
          status?: Database["public"]["Enums"]["rights_flag_status"]
          title: string
          updated_at?: string
        }
        Update: {
          affected_entity_id?: string | null
          affected_entity_type?: string
          created_at?: string
          description?: string
          evidence_context?: string | null
          id?: string
          owner_user_id?: string
          passport_key?: string
          recommended_action?: string | null
          resolved_at?: string | null
          rule_code?: string
          severity?: Database["public"]["Enums"]["rights_flag_severity"]
          status?: Database["public"]["Enums"]["rights_flag_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          audience_type: string
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          consent_source: string | null
          consent_version: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          sequence_step2_sent_at: string | null
          sequence_step3_sent_at: string | null
          source: string
          status: string
          topic_interest: string | null
          unsubscribed_at: string | null
          welcome_sent_at: string | null
        }
        Insert: {
          audience_type?: string
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          consent_source?: string | null
          consent_version?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          sequence_step2_sent_at?: string | null
          sequence_step3_sent_at?: string | null
          source?: string
          status?: string
          topic_interest?: string | null
          unsubscribed_at?: string | null
          welcome_sent_at?: string | null
        }
        Update: {
          audience_type?: string
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          consent_source?: string | null
          consent_version?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          sequence_step2_sent_at?: string | null
          sequence_step3_sent_at?: string | null
          source?: string
          status?: string
          topic_interest?: string | null
          unsubscribed_at?: string | null
          welcome_sent_at?: string | null
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
      aurum_marketplace_gap_signals: {
        Row: {
          category_hint: string | null
          conversion_count: number | null
          first_seen_at: string | null
          last_seen_at: string | null
          low_confidence_count: number | null
          no_result_count: number | null
          objective_key: string | null
          request_count: number | null
          result_count: number | null
        }
        Relationships: []
      }
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
      creator_studio_server_apply_provider_status: {
        Args: {
          _actual_cost_cents?: number
          _error_code?: string
          _job_status: string
          _output_storage_path?: string
          _provider_metadata?: Json
          _provider_output_url?: string
          _provider_status: string
          _render_job_id: string
          _safe_error_message?: string
        }
        Returns: boolean
      }
      creator_studio_server_apply_subscription_event: {
        Args: {
          _billing_status: string
          _cancel_at_period_end: boolean
          _event_created: string
          _event_type: string
          _owner_user_id: string
          _period_end: string
          _period_start: string
          _plan_key: string
          _stripe_customer_id: string
          _stripe_environment: string
          _stripe_event_id: string
          _stripe_price_id: string
          _stripe_subscription_id: string
        }
        Returns: boolean
      }
      creator_studio_server_cancel_render: {
        Args: { _actor_user_id: string; _render_job_id: string }
        Returns: boolean
      }
      creator_studio_server_claim_render_submission: {
        Args: { _callback_secret_hash: string; _render_job_id: string }
        Returns: boolean
      }
      creator_studio_server_complete_asset: {
        Args: {
          _actor_user_id: string
          _asset_id: string
          _height?: number
          _width?: number
        }
        Returns: boolean
      }
      creator_studio_server_expire_stuck_renders: {
        Args: { _limit?: number }
        Returns: number
      }
      creator_studio_server_grant_extra_video_event: {
        Args: {
          _event_created: string
          _event_type: string
          _owner_user_id: string
          _quantity: number
          _stripe_checkout_session_id: string
          _stripe_environment: string
          _stripe_event_id: string
        }
        Returns: boolean
      }
      creator_studio_server_mark_render_submitted: {
        Args: {
          _callback_secret_hash: string
          _provider_job_id: string
          _render_job_id: string
        }
        Returns: boolean
      }
      creator_studio_server_mark_submission_failed: {
        Args: {
          _error_code: string
          _render_job_id: string
          _safe_error_message: string
        }
        Returns: boolean
      }
      creator_studio_server_release_reserved_asset: {
        Args: { _actor_user_id: string; _asset_id: string }
        Returns: boolean
      }
      creator_studio_server_remove_asset: {
        Args: { _actor_user_id: string; _asset_id: string }
        Returns: string
      }
      creator_studio_server_reserve_asset: {
        Args: {
          _actor_user_id: string
          _asset_id: string
          _byte_size: number
          _category: string
          _mime_type: string
          _original_filename: string
          _project_id: string
          _storage_path: string
        }
        Returns: string
      }
      creator_studio_server_reserve_entitled_render_job: {
        Args: {
          _actor_user_id: string
          _idempotency_key: string
          _project_id: string
          _template_version: string
        }
        Returns: {
          quality: string
          render_job_id: string
          usage_source: string
        }[]
      }
      creator_studio_server_reserve_render_job: {
        Args: {
          _actor_user_id: string
          _idempotency_key: string
          _project_id: string
          _quality: string
          _template_version: string
        }
        Returns: string
      }
      creator_studio_valid_transition: {
        Args: { _from: string; _to: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
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
      is_assurance_member: { Args: { org_id: string }; Returns: boolean }
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
      resolve_product_slug_redirect: {
        Args: { _old_slug: string }
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
      audiobook_attestation_status: "PENDING" | "ATTESTED" | "REVOKED"
      audiobook_job_status:
        | "QUEUED"
        | "GENERATING"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
        | "RETRYING"
      audiobook_usage_kind: "ESTIMATE" | "ACTUAL"
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
      rights_ai_policy:
        | "ALLOW"
        | "ALLOW_WITH_TERMS"
        | "PROHIBIT"
        | "CASE_BY_CASE"
        | "CONTACT_FOR_LICENSE"
        | "REVIEW_REQUIRED"
      rights_ai_use_case:
        | "GENERAL_AI_TRAINING"
        | "FINE_TUNING_CUSTOM_MODEL"
        | "EMBEDDING_RETRIEVAL"
        | "VOICE_CLONE"
        | "SYNTHETIC_VOICE"
        | "DIGITAL_REPLICA"
        | "FACE_LIKENESS_GENERATION"
        | "SYNTHETIC_VIDEO"
        | "MOTION_PERFORMANCE_SIMULATION"
        | "AVATAR_VIRTUAL_HUMAN"
        | "GAME_CHARACTER"
        | "GENERATED_ADVERTISEMENT"
        | "PERSONALIZED_CONTENT"
        | "STYLE_PERSONA_SIMULATION"
        | "TRANSLATION_DUBBING"
        | "AI_REMIX_DERIVATIVE"
        | "PROMPT_DATASET_EXAMPLE"
        | "BENCHMARK_EVALUATION"
        | "SEARCH_DISCOVERY_INDEXING"
        | "COMMERCIAL_MODEL_OUTPUT"
        | "NONCOMMERCIAL_RESEARCH"
        | "POSTHUMOUS_ESTATE_USE"
      rights_analysis_pass_type:
        | "DOCUMENT_STRUCTURE"
        | "RIGHTS_GRANT"
        | "AI_SYNTHETIC_RIGHTS"
        | "COMMERCIAL_TERMS"
        | "RISK_CONFLICT_SIGNALS"
      rights_analysis_run_status:
        | "PENDING"
        | "RUNNING"
        | "COMPLETE"
        | "PARTIAL"
        | "FAILED"
      rights_analysis_status:
        | "PENDING"
        | "ANALYZING"
        | "COMPLETE"
        | "PARTIAL"
        | "FAILED"
      rights_asset_status:
        | "ACTIVE"
        | "DISPUTED"
        | "REVIEW_REQUIRED"
        | "ARCHIVED"
      rights_asset_type:
        | "NAME"
        | "STAGE_NAME"
        | "LIKENESS_IMAGE"
        | "VOICE"
        | "SIGNATURE"
        | "MOVEMENT_MANNERISM"
        | "BIOGRAPHY"
        | "SOCIAL_HANDLE"
        | "CREATIVE_WORK"
        | "MUSIC"
        | "BOOK_WRITING"
        | "VIDEO_FILM"
        | "PHOTOGRAPH"
        | "ARTWORK_DESIGN"
        | "CHARACTER"
        | "TRADEMARK_MARK"
        | "LOGO"
        | "COURSE_TRAINING"
        | "PODCAST_MEDIA"
        | "DIGITAL_PRODUCT"
        | "DATASET_ARCHIVE"
        | "OTHER"
      rights_control_basis:
        | "CREATORSHIP"
        | "CONTRACT"
        | "ASSIGNMENT"
        | "LICENSE"
        | "TRADEMARK"
        | "PUBLICITY_PERSONALITY_RIGHT"
        | "ENTITY_OWNERSHIP"
        | "REPRESENTATIVE_AUTHORITY"
        | "OTHER"
        | "REVIEW_REQUIRED"
      rights_document_status:
        | "UPLOADED"
        | "PARSING"
        | "PARSED"
        | "ANALYZING"
        | "REVIEW_REQUIRED"
        | "READY_FOR_REVIEW"
        | "ACCEPTED"
        | "PARTIALLY_ACCEPTED"
        | "REJECTED"
        | "FAILED"
      rights_document_type:
        | "LICENSING_AGREEMENT"
        | "ENDORSEMENT_AGREEMENT"
        | "MUSIC_AGREEMENT"
        | "CREATOR_AGREEMENT"
        | "TALENT_RELEASE"
        | "ASSIGNMENT"
        | "BRAND_AGREEMENT"
        | "REGISTRATION"
        | "EVIDENCE_DOCUMENT"
        | "PLATFORM_TERMS"
        | "OTHER"
      rights_evidence_status:
        | "VERIFIED"
        | "SELF_DECLARED"
        | "PENDING"
        | "DISPUTED"
        | "EXPIRED"
        | "REVIEW_REQUIRED"
      rights_evidence_type:
        | "SOURCE_FILE"
        | "CONTRACT"
        | "COPYRIGHT_REGISTRATION"
        | "TRADEMARK_REGISTRATION"
        | "MODEL_TALENT_RELEASE"
        | "SPLIT_OWNERSHIP_RECORD"
        | "IDENTITY_DOCUMENT"
        | "CONTENT_CREDENTIAL"
        | "HASH"
        | "PUBLICATION_RECORD"
        | "TIMESTAMP"
        | "OTHER"
      rights_finding_review_status:
        | "PENDING"
        | "ACCEPTED"
        | "EDITED"
        | "REJECTED"
        | "DEFERRED"
      rights_flag_severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW"
      rights_flag_status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "ACCEPTED_RISK"
      rights_license_permission_type:
        | "LICENSE"
        | "CONSENT"
        | "WAIVER"
        | "ASSIGNMENT"
        | "SERVICE_AGREEMENT"
        | "PLATFORM_TERMS"
        | "OTHER"
      rights_license_status:
        | "ACTIVE"
        | "PENDING"
        | "EXPIRED"
        | "REVOKED"
        | "SUPERSEDED"
        | "REVIEW_REQUIRED"
      rights_parse_status:
        | "PENDING"
        | "PARSING"
        | "PARSED"
        | "OCR_REQUIRED"
        | "FAILED"
      rights_passport_plan:
        | "FREE_PREVIEW"
        | "PERSONAL"
        | "PROFESSIONAL"
        | "BUSINESS"
      rights_passport_status:
        | "DRAFT"
        | "ACTIVE"
        | "SUPERSEDED"
        | "REVOKED"
        | "ARCHIVED"
      rights_permission:
        | "ALLOW"
        | "ALLOW_WITH_TERMS"
        | "PROHIBIT"
        | "CASE_BY_CASE"
        | "CONTACT_FOR_LICENSE"
        | "REVIEW_REQUIRED"
      rights_snapshot_status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "ARCHIVED"
      rights_verification_level:
        | "SELF_DECLARED"
        | "DOCUMENT_SUPPORTED"
        | "REPRESENTATIVE_VERIFIED"
        | "THIRD_PARTY_VERIFIED"
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
      academy_difficulty: ["beginner", "intermediate", "advanced"],
      app_role: ["admin", "seller", "buyer"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "under_review",
        "info_requested",
      ],
      audiobook_attestation_status: ["PENDING", "ATTESTED", "REVOKED"],
      audiobook_job_status: [
        "QUEUED",
        "GENERATING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "RETRYING",
      ],
      audiobook_usage_kind: ["ESTIMATE", "ACTUAL"],
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
      rights_ai_policy: [
        "ALLOW",
        "ALLOW_WITH_TERMS",
        "PROHIBIT",
        "CASE_BY_CASE",
        "CONTACT_FOR_LICENSE",
        "REVIEW_REQUIRED",
      ],
      rights_ai_use_case: [
        "GENERAL_AI_TRAINING",
        "FINE_TUNING_CUSTOM_MODEL",
        "EMBEDDING_RETRIEVAL",
        "VOICE_CLONE",
        "SYNTHETIC_VOICE",
        "DIGITAL_REPLICA",
        "FACE_LIKENESS_GENERATION",
        "SYNTHETIC_VIDEO",
        "MOTION_PERFORMANCE_SIMULATION",
        "AVATAR_VIRTUAL_HUMAN",
        "GAME_CHARACTER",
        "GENERATED_ADVERTISEMENT",
        "PERSONALIZED_CONTENT",
        "STYLE_PERSONA_SIMULATION",
        "TRANSLATION_DUBBING",
        "AI_REMIX_DERIVATIVE",
        "PROMPT_DATASET_EXAMPLE",
        "BENCHMARK_EVALUATION",
        "SEARCH_DISCOVERY_INDEXING",
        "COMMERCIAL_MODEL_OUTPUT",
        "NONCOMMERCIAL_RESEARCH",
        "POSTHUMOUS_ESTATE_USE",
      ],
      rights_analysis_pass_type: [
        "DOCUMENT_STRUCTURE",
        "RIGHTS_GRANT",
        "AI_SYNTHETIC_RIGHTS",
        "COMMERCIAL_TERMS",
        "RISK_CONFLICT_SIGNALS",
      ],
      rights_analysis_run_status: [
        "PENDING",
        "RUNNING",
        "COMPLETE",
        "PARTIAL",
        "FAILED",
      ],
      rights_analysis_status: [
        "PENDING",
        "ANALYZING",
        "COMPLETE",
        "PARTIAL",
        "FAILED",
      ],
      rights_asset_status: [
        "ACTIVE",
        "DISPUTED",
        "REVIEW_REQUIRED",
        "ARCHIVED",
      ],
      rights_asset_type: [
        "NAME",
        "STAGE_NAME",
        "LIKENESS_IMAGE",
        "VOICE",
        "SIGNATURE",
        "MOVEMENT_MANNERISM",
        "BIOGRAPHY",
        "SOCIAL_HANDLE",
        "CREATIVE_WORK",
        "MUSIC",
        "BOOK_WRITING",
        "VIDEO_FILM",
        "PHOTOGRAPH",
        "ARTWORK_DESIGN",
        "CHARACTER",
        "TRADEMARK_MARK",
        "LOGO",
        "COURSE_TRAINING",
        "PODCAST_MEDIA",
        "DIGITAL_PRODUCT",
        "DATASET_ARCHIVE",
        "OTHER",
      ],
      rights_control_basis: [
        "CREATORSHIP",
        "CONTRACT",
        "ASSIGNMENT",
        "LICENSE",
        "TRADEMARK",
        "PUBLICITY_PERSONALITY_RIGHT",
        "ENTITY_OWNERSHIP",
        "REPRESENTATIVE_AUTHORITY",
        "OTHER",
        "REVIEW_REQUIRED",
      ],
      rights_document_status: [
        "UPLOADED",
        "PARSING",
        "PARSED",
        "ANALYZING",
        "REVIEW_REQUIRED",
        "READY_FOR_REVIEW",
        "ACCEPTED",
        "PARTIALLY_ACCEPTED",
        "REJECTED",
        "FAILED",
      ],
      rights_document_type: [
        "LICENSING_AGREEMENT",
        "ENDORSEMENT_AGREEMENT",
        "MUSIC_AGREEMENT",
        "CREATOR_AGREEMENT",
        "TALENT_RELEASE",
        "ASSIGNMENT",
        "BRAND_AGREEMENT",
        "REGISTRATION",
        "EVIDENCE_DOCUMENT",
        "PLATFORM_TERMS",
        "OTHER",
      ],
      rights_evidence_status: [
        "VERIFIED",
        "SELF_DECLARED",
        "PENDING",
        "DISPUTED",
        "EXPIRED",
        "REVIEW_REQUIRED",
      ],
      rights_evidence_type: [
        "SOURCE_FILE",
        "CONTRACT",
        "COPYRIGHT_REGISTRATION",
        "TRADEMARK_REGISTRATION",
        "MODEL_TALENT_RELEASE",
        "SPLIT_OWNERSHIP_RECORD",
        "IDENTITY_DOCUMENT",
        "CONTENT_CREDENTIAL",
        "HASH",
        "PUBLICATION_RECORD",
        "TIMESTAMP",
        "OTHER",
      ],
      rights_finding_review_status: [
        "PENDING",
        "ACCEPTED",
        "EDITED",
        "REJECTED",
        "DEFERRED",
      ],
      rights_flag_severity: ["CRITICAL", "HIGH", "MODERATE", "LOW"],
      rights_flag_status: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "ACCEPTED_RISK"],
      rights_license_permission_type: [
        "LICENSE",
        "CONSENT",
        "WAIVER",
        "ASSIGNMENT",
        "SERVICE_AGREEMENT",
        "PLATFORM_TERMS",
        "OTHER",
      ],
      rights_license_status: [
        "ACTIVE",
        "PENDING",
        "EXPIRED",
        "REVOKED",
        "SUPERSEDED",
        "REVIEW_REQUIRED",
      ],
      rights_parse_status: [
        "PENDING",
        "PARSING",
        "PARSED",
        "OCR_REQUIRED",
        "FAILED",
      ],
      rights_passport_plan: [
        "FREE_PREVIEW",
        "PERSONAL",
        "PROFESSIONAL",
        "BUSINESS",
      ],
      rights_passport_status: [
        "DRAFT",
        "ACTIVE",
        "SUPERSEDED",
        "REVOKED",
        "ARCHIVED",
      ],
      rights_permission: [
        "ALLOW",
        "ALLOW_WITH_TERMS",
        "PROHIBIT",
        "CASE_BY_CASE",
        "CONTACT_FOR_LICENSE",
        "REVIEW_REQUIRED",
      ],
      rights_snapshot_status: ["ACTIVE", "SUPERSEDED", "REVOKED", "ARCHIVED"],
      rights_verification_level: [
        "SELF_DECLARED",
        "DOCUMENT_SUPPORTED",
        "REPRESENTATIVE_VERIFIED",
        "THIRD_PARTY_VERIFIED",
      ],
    },
  },
} as const
