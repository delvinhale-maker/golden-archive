import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * Secure ingest endpoint for new Academy articles.
 *
 * HARD RULE: articles are ALWAYS inserted as status = 'draft' with
 * published_at = null and archived = false. The payload cannot change this.
 * Publishing requires an explicit human action inside AurumVault.
 */

const SITE_ORIGIN = 'https://www.aurumvault.store'

const ALLOWED_CATEGORIES = new Set([
  'financial-freedom',
  'ai-productivity',
  'digital-publishing',
  'kingdom-living',
  'entrepreneurship',
])

const PayloadSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(50).max(200000),
  seo_title: z.string().trim().max(200).optional().nullable(),
  meta_description: z.string().trim().max(320).optional().nullable(),
  focus_keyword: z.string().trim().max(120).optional().nullable(),
  secondary_keywords: z.array(z.string().trim().min(1).max(120)).max(25).optional(),
  slug: z.string().trim().max(180).optional().nullable(),
  category: z.string().trim().min(1).max(80),
  recommended_product: z.string().trim().max(200).optional().nullable(),
  excerpt: z.string().trim().max(600).optional().nullable(),
})

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export const Route = createFileRoute('/api/public/academy/receive-article')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey = process.env.ACADEMY_INGEST_API_KEY
        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!expectedKey || !supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const provided =
          request.headers.get('x-api-key') ??
          (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
        if (!provided || !timingSafeEqual(provided, expectedKey)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let parsed
        try {
          parsed = PayloadSchema.parse(await request.json())
        } catch (err) {
          return Response.json(
            { error: 'Invalid payload', details: err instanceof z.ZodError ? err.issues : undefined },
            { status: 400 },
          )
        }

        if (!ALLOWED_CATEGORIES.has(parsed.category)) {
          return Response.json(
            { error: `Unknown category. Allowed: ${[...ALLOWED_CATEGORIES].join(', ')}` },
            { status: 400 },
          )
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        })

        const baseSlug = slugify(parsed.slug || parsed.title) || 'academy-article'
        const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`
        const words = parsed.body.trim().split(/\s+/).length

        const { data: article, error } = await supabase
          .from('academy_articles')
          .insert({
            slug,
            title: parsed.title,
            excerpt: parsed.excerpt ?? null,
            body: parsed.body,
            category: parsed.category,
            author_name: 'AurumVault Editorial',
            reading_time_min: Math.max(1, Math.round(words / 220)),
            meta_title: parsed.seo_title ?? null,
            meta_description: parsed.meta_description ?? null,
            focus_keyword: parsed.focus_keyword ?? null,
            secondary_keywords: parsed.secondary_keywords ?? [],
            word_count: words,
            // HARD RULE — never publishable via this endpoint:
            status: 'draft',
            published_at: null,
            scheduled_for: null,
            featured: false,
            pinned: false,
            archived: false,
          })
          .select('id, slug, status')
          .single()

        if (error || !article) {
          console.error('[receive-academy-article] insert failed', error)
          return Response.json({ error: 'Could not create article' }, { status: 500 })
        }

        // Optional: link a recommended product by exact/partial title match.
        let linkedProductId: string | null = null
        if (parsed.recommended_product) {
          const { data: product } = await supabase
            .from('marketplace_products')
            .select('id')
            .ilike('title', `%${parsed.recommended_product}%`)
            .eq('status', 'approved')
            .limit(1)
            .maybeSingle()
          if (product?.id) {
            const { error: linkError } = await supabase
              .from('academy_article_products')
              .insert({ article_id: article.id, product_id: product.id, sort_order: 0 })
            if (!linkError) linkedProductId = product.id
          }
        }

        return Response.json(
          {
            ok: true,
            id: article.id,
            slug: article.slug,
            status: article.status,
            recommended_product_id: linkedProductId,
            edit_url: `${SITE_ORIGIN}/admin/academy/${article.id}`,
            preview_url: `${SITE_ORIGIN}/academy/article/${article.slug}`,
            note: 'Saved as draft. It will not appear publicly until you publish it in AurumVault.',
          },
          { status: 201 },
        )
      },
    },
  },
})
