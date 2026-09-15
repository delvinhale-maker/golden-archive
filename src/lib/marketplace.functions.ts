import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { slugToLabel, labelToSlug, getCategoryDef, getQueryableSlugsFor, CATEGORIES as CATEGORY_DEFS } from "@/lib/categories";
import { canonicalProductSegment, shouldRedirectProductRequest } from "@/lib/product-slug-redirect";
import { MARKETPLACE_PAGE_SIZE, FEATURED_PRODUCTS_LIMIT } from "@/lib/marketplace-config";
import { rotateHalfDay } from "@/lib/affiliate-rotation";


const API_BASE = "https://web-builder-pro-delvinhale.replit.app/api";

function serverSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type DbProductRow = {
  id: string;
  slug?: string | null;
  title: string;
  category: string;
  subcategory?: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  cover_url: string | null;
  description: string | null;
  seller_id: string;
  created_at: string;
  status?: string;
  published?: boolean;
  ai_review_status?: string | null;
  ai_review_score?: number | null;
  is_preorder?: boolean | null;
  release_date?: string | null;
  released_at?: string | null;
  preorder_note?: string | null;
  admin_notes?: string | null;
  file_path?: string | null;
  preview_pages?: number[] | null;
  product_type?: string | null;
  delivery_contents?: string[] | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image_alt?: string | null;
  seo_og_title?: string | null;
  seo_og_description?: string | null;
  seo_robots_index?: boolean | null;
  seo_robots_follow?: boolean | null;
};

export function parseWhatsIncluded(adminNotes?: string | null): string[] | undefined {
  if (!adminNotes) return undefined;
  try {
    const parsed = JSON.parse(adminNotes) as Record<string, unknown>;
    const raw = parsed.whatsIncluded;
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    return raw
      .split(/\r?\n|•|-\s|\*\s/)
      .map((s) => s.replace(/^[•\-\*]\s*/, "").trim())
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

function dbRowToProduct(r: DbProductRow): Product {
  const catLabel = slugToLabel(r.category);
  const compareAt = r.compare_at_price_cents != null && r.compare_at_price_cents > r.price_cents ? r.compare_at_price_cents / 100 : undefined;
  const isPreorder = !!r.is_preorder && !r.released_at && (!r.release_date || new Date(r.release_date).getTime() > Date.now());
  const isEbook = r.category.toLowerCase() === "ebooks";
  const included = isEbook ? undefined : parseWhatsIncluded(r.admin_notes);
  return {
    id: r.id,
    slug: r.slug ?? null,
    title: r.title,
    category: catLabel,
    subcategory: r.subcategory ?? null,
    price: r.price_cents / 100,
    compareAtPrice: compareAt,
    rating: 0,
    reviewCount: 0,
    image: r.cover_url && r.cover_url.trim().length > 0 ? r.cover_url : `av:${catLabel}:0`,
    bestseller: false,
    creator: { id: r.seller_id, name: "AurumVault", verified: false, isAurumVaultOwned: true },
    description: r.description ?? undefined,
    included,
    aiReviewStatus: (r.ai_review_status as Product["aiReviewStatus"]) ?? null,
    aiReviewScore: r.ai_review_score ?? null,
    isPreorder,
    releaseDate: r.release_date ?? null,
    preorderNote: r.preorder_note ?? null,
    previewPages: Array.isArray(r.preview_pages) ? r.preview_pages : [],
    fileExt: (r.file_path ?? "").split(".").pop()?.toLowerCase() ?? null,
    productType: r.product_type ?? null,
    deliveryContents: Array.isArray(r.delivery_contents) ? r.delivery_contents : [],
    seoTitle: r.seo_title?.trim() || null,
    seoDescription: r.seo_description?.trim() || null,
    seoImageAlt: r.seo_image_alt?.trim() || null,
    seoOgTitle: r.seo_og_title?.trim() || null,
    seoOgDescription: r.seo_og_description?.trim() || null,
    seoRobotsIndex: r.seo_robots_index ?? true,
    seoRobotsFollow: r.seo_robots_follow ?? true,
  };
}

async function fetchReviewAggregates(supa: ReturnType<typeof serverSupabase>, productIds: string[]): Promise<Map<string, { rating: number; count: number }>> {
  const map = new Map<string, { rating: number; count: number }>();
  if (productIds.length === 0) return map;
  const { data, error } = await supa.from("product_reviews").select("product_id,rating").in("product_id", productIds);
  if (error || !data) return map;
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const row of data as Array<{ product_id: string; rating: number }>) {
    const cur = buckets.get(row.product_id) ?? { sum: 0, n: 0 };
    cur.sum += row.rating;
    cur.n += 1;
    buckets.set(row.product_id, cur);
  }
  for (const [id, { sum, n }] of buckets.entries()) map.set(id, { rating: n > 0 ? sum / n : 0, count: n });
  return map;
}

function applyAggregates(products: Product[], agg: Map<string, { rating: number; count: number }>): Product[] {
  return products.map((p) => {
    const a = agg.get(p.id);
    if (!a) return p;
    return { ...p, rating: Math.round(a.rating * 10) / 10, reviewCount: a.count };
  });
}

export async function fetchCreatorInfoMap(supa: ReturnType<typeof serverSupabase>, sellerIds: string[]): Promise<Map<string, PublicCreatorRef>> {
  const map = new Map<string, PublicCreatorRef>();
  const uniqueIds = [...new Set(sellerIds)];
  if (uniqueIds.length === 0) return map;
  const [appsRes, profilesRes] = await Promise.all([
    supa.from("seller_applications").select("user_id,brand_name,brand_slug,status").in("user_id", uniqueIds),
    supa.from("profiles").select("id,avatar_url").in("id", uniqueIds),
  ]);
  const avatarByUser = new Map<string, string | null>();
  for (const row of (profilesRes.data ?? []) as Array<{ id: string; avatar_url: string | null }>) avatarByUser.set(row.id, row.avatar_url);
  for (const row of (appsRes.data ?? []) as Array<{ user_id: string; brand_name: string; brand_slug: string | null; status: string }>) {
    const eligible = row.status === "approved" && !!row.brand_slug;
    map.set(row.user_id, { id: row.user_id, name: eligible ? row.brand_name : "AurumVault", slug: eligible ? row.brand_slug! : undefined, avatar: eligible ? avatarByUser.get(row.user_id) ?? undefined : undefined, verified: eligible, isAurumVaultOwned: false });
  }
  for (const id of uniqueIds) if (!map.has(id)) map.set(id, { id, name: "AurumVault", verified: false, isAurumVaultOwned: true });
  return map;
}

function applyCreatorInfo(products: Product[], creators: Map<string, PublicCreatorRef>): Product[] {
  return products.map((p) => ({ ...p, creator: creators.get(p.creator.id) ?? p.creator }));
}

async function fetchDbProducts(opts: { category?: string; q?: string } = {}): Promise<Product[]> {
  try {
    const supa = serverSupabase();
    let query = supa.from("marketplace_products").select("id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at").eq("status", "approved").eq("published", true).order("created_at", { ascending: false });
    if (opts.category && opts.category.toLowerCase() !== "all") {
      let slug = getCategoryDef(opts.category)?.slug ?? labelToSlug(opts.category) ?? opts.category.toLowerCase();
      if (slug === "prompt_packs") slug = "ai_prompt_packs";
      const slugs = getQueryableSlugsFor(slug);
      query = query.in("category", (slugs.length ? slugs : [slug]) as Database["public"]["Enums"]["product_category"][]);
    }
    if (opts.q) {
      const term = opts.q.replace(/[%,()]/g, " ").trim();
      const lower = term.toLowerCase();
      const slugTerm = lower.replace(/[\s/&-]+/g, "_");
      const filters = [`title.ilike.%${term}%`, `description.ilike.%${term}%`, `subcategory.ilike.%${term}%`, `product_type.ilike.%${term}%`, `product_type.ilike.%${slugTerm}%`];
      const matchedCategorySlugs = CATEGORY_DEFS.filter((c) => c.label.toLowerCase().includes(lower) || lower.includes(c.label.toLowerCase())).map((c) => c.slug);
      for (const slug of new Set(matchedCategorySlugs)) filters.push(`category.eq.${slug}`);
      query = query.or(filters.join(","));
    }
    const { data, error } = await query;
    if (error || !data) return [];
    const products = (data as DbProductRow[]).map(dbRowToProduct);
    const [agg, creators] = await Promise.all([fetchReviewAggregates(supa, products.map((p) => p.id)), fetchCreatorInfoMap(supa, products.map((p) => p.creator.id))]);
    return applyCreatorInfo(applyAggregates(products, agg), creators);
  } catch { return []; }
}

export type Creator = { id: string; name: string; tagline: string; avatar: string; verified: boolean; productsCount: number; salesCount: number; bio?: string };
export type PublicCreatorRef = { id: string; name: string; verified: boolean; avatar?: string; slug?: string; isAurumVaultOwned: boolean };
export type Product = { id: string; slug?: string | null; title: string; category: string; subcategory?: string | null; price: number; compareAtPrice?: number; rating: number; reviewCount: number; image: string; images?: string[]; bestseller?: boolean; creator: PublicCreatorRef; description?: string; included?: string[]; aiReviewStatus?: "pass" | "warn" | "fail" | "pending" | null; aiReviewScore?: number | null; isPreorder?: boolean; releaseDate?: string | null; preorderNote?: string | null; previewPages?: number[]; fileExt?: string | null; productType?: string | null; deliveryContents?: string[]; seoTitle?: string | null; seoDescription?: string | null; seoImageAlt?: string | null; seoOgTitle?: string | null; seoOgDescription?: string | null; seoRobotsIndex?: boolean; seoRobotsFollow?: boolean; seoFocusKeyword?: never; seoSecondaryKeywords?: never };
export type ProductReviewSnippet = { id: string; author: string; rating: number; title: string | null; body: string; createdAt: string };
export type ProductRatingBreakdown = { 1: number; 2: number; 3: number; 4: number; 5: number };
export type ProductDetailResult = | { kind: "published"; product: Product; reviews: ProductReviewSnippet[]; ratingBreakdown: ProductRatingBreakdown } | { kind: "unpublished"; title: string | null } | { kind: "redirect"; slug: string } | { kind: "notFound" };

const CATEGORIES = ["eBooks", "Journals", "Templates", "Audio", "Financial Planners", "Leadership", "Purpose", "Business"];
const CREATOR_NAMES = [["AurumVault", "Curated by AurumVault"]];
const TITLES_BY_CAT: Record<string, string[]> = {
  eBooks: ["The Stewardship Codex","Quiet Equity","Letters to a Young Operator","The Patient Capital Series","Wealth With Reverence","The Founder's Daily Office","Sovereign Mornings","The Inheritance Manual","Boardroom Liturgy","Built to Endure","The Long Compounding","Notes on a Quiet Empire","The Discipline of Restraint","Heir Mindset Field Guide","The Architecture of Trust"],
  Courses: ["Sovereign Leadership Playbook","Quiet Equity: The 12-Week Course","Brand Theology Intensive","The Capital Architect Program","Heir Mindset Workshop","Operator's Bootcamp","Purposeful Pricing Masterclass","Boardroom Communication Lab","Founder OS — Cohort 03","The Stewardship Sprint","Patient Capital Fundamentals","Legacy Brand Studio","Wealth Liturgy: 30 Days","Operator-Investor Track"],
  Templates: ["Operator's Calendar 2025","Boardroom Deck Kit","Founder Wiki — Notion Build","Cap Table Atlas","Investor Memo Library","Quarterly Review Workbook","Hiring Loop Templates","Brand Theology Brief Pack","Pricing Architecture Sheets","Customer Discovery Canvas","OKR Liturgy — Notion","Series A Data Room Kit","Executive 1:1 System","Annual Letter Template"],
  Audio: ["Boardroom Liturgy — Audio","Morning Office for Founders","Quiet Capital Meditations","The Stewardship Recitations","Operator's Examen","Vespers for Builders","Compline of the Long Game","Lectio for Leaders","The Sovereign Hour","Daily Office: Equity Edition","Vigils of the Operator","Patient Capital — Lossless","Heir Mindset Audio Course","The Architect's Recordings"],
  Finance: ["The Patient Capital Series","Quiet Equity Playbook","Cap Table Atlas","Long Compounding Notebook","Steward Portfolio Models","Family Office Field Guide","Endowment Discipline","The Reverent Investor","Private Markets Liturgy","Treasury Architecture","Allocator's Daily Office","Diligence Sheets — Pro","Capital Architecture 101","The Sovereign Allocator"],
  Leadership: ["Sovereign Leadership Playbook","Boardroom Liturgy","The Stewardship Codex","Quiet Authority","Letters to a Young Operator","Heir Mindset Workshop","The Long Conversation","Founder's Examen","Leadership With Reverence","The Architect's Council","Operator Theology","The Patient Leader","Sovereign Mornings","Council of Three"],
  Purpose: ["Built to Endure","The Inheritance Manual","Wealth With Reverence","Notes on a Quiet Empire","Brand Theology","Purposeful Pricing","The Long Game Manifesto","Vocation of the Operator","Capital as Liturgy","Quiet Empire Field Guide","The Sacred Spreadsheet","Steward Manifesto","Slow Growth Doctrine","Reverent Ambition"],
  Business: ["Operator's Calendar 2025","Founder OS","Quiet Equity Playbook","Brand Theology: A Field Manual","Purposeful Pricing","Hiring Loop Manual","Annual Letter Workshop","Series A Survival Kit","The Patient Operator","Customer Discovery Liturgy","Margin Architecture","The Reverent Roadmap","Quiet Distribution","Operator-Investor Handbook"],
};
function pickTitle(category: string, index: number): string { const pool = TITLES_BY_CAT[category] ?? TITLES_BY_CAT.Business; return pool[index % pool.length]; }
function priceFor(cat: string, idx: number): number { const bands: Record<string,[number,number]> = {eBooks:[9,29],Courses:[27,97],Templates:[17,47],Audio:[12,37],Finance:[19,67],Leadership:[19,67],Purpose:[12,47],Business:[17,57]}; const [lo,hi] = bands[cat] ?? [9,67]; return lo + ((idx*7+cat.length*3)%(hi-lo+1)); }
function mockCreator(i: number): Creator { const [name,tagline] = CREATOR_NAMES[i % CREATOR_NAMES.length]; return {id:`c_${i}`,name,tagline,avatar:`https://i.pravatar.cc/160?img=${(i%70)+1}`,verified:true,productsCount:6+(i%18),salesCount:320+i*47,bio:"Building purpose-driven resources for operators, founders, and leaders who measure outcomes in legacy."}; }
function mockProduct(absoluteIndex:number,category?:string):Product { const cat=category??CATEGORIES[absoluteIndex%CATEGORIES.length]; const titleIndex=category?absoluteIndex:Math.floor(absoluteIndex/CATEGORIES.length); const title=pickTitle(cat,titleIndex); const id=category?`p_${cat.toLowerCase()}_${absoluteIndex}`:`p_${absoluteIndex}`; const price=priceFor(cat,absoluteIndex); const compareRaw=absoluteIndex%3===0?price+20:undefined; const compare=compareRaw&&compareRaw<=97?compareRaw:undefined; const creatorIdx=absoluteIndex%CREATOR_NAMES.length; return {id,title,category:cat,price,compareAtPrice:compare,rating:0,reviewCount:0,image:`av:${cat}:${absoluteIndex}`,bestseller:absoluteIndex%4===0,creator:{id:`c_${creatorIdx}`,name:CREATOR_NAMES[creatorIdx][0],verified:true,avatar:`https://i.pravatar.cc/80?img=${(creatorIdx*7)+1}`,isAurumVaultOwned:true},description:"A premium, purpose-driven resource curated for operators who want to build with intention. Includes worksheets, audio reflections, and a printable companion.",included:["200-page main PDF (print-ready)","Companion audio (3 hours, AAC)","12 Notion & Figma templates","Lifetime updates"]}; }
function mockProductsAcross(n:number,offset=0){return Array.from({length:n},(_,i)=>mockProduct(i+offset));}
function mockProductsForCategory(cat:string,n:number,offset=0){return Array.from({length:n},(_,i)=>mockProduct(i+offset,cat));}
const mockCreators=(n:number)=>Array.from({length:n},(_,i)=>mockCreator(i));
async function safeFetch<T>(path:string,fallback:T):Promise<T>{try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),4000);const res=await fetch(`${API_BASE}${path}`,{signal:ctrl.signal});clearTimeout(t);if(!res.ok)return fallback;const data=(await res.json()) as T;return data??fallback;}catch{return fallback;}}
function rotateDaily<T>(arr:T[],salt=0):T[]{if(arr.length<=1)return arr;const n=arr.length;const intervalMs=Math.max(1,Math.floor(86_400_000/n));const tick=Math.floor(Date.now()/intervalMs);const offset=(((tick+salt)%n)+n)%n;return arr.slice(offset).concat(arr.slice(0,offset));}

export const getFeaturedProducts=createServerFn({method:"GET"}).handler(async()=>rotateDaily(await fetchDbProducts(),0).slice(0,FEATURED_PRODUCTS_LIMIT));
export const getProducts=createServerFn({method:"GET"}).inputValidator((input:unknown)=>z.object({category:z.string().optional(),sort:z.string().optional(),page:z.number().int().min(1).default(1),pageSize:z.number().int().min(1).max(100).default(MARKETPLACE_PAGE_SIZE),q:z.string().optional()}).parse(input??{})).handler(async({data})=>{const all=await fetchDbProducts({category:data.category,q:data.q});const total=all.length;const start=(data.page-1)*data.pageSize;const items=all.slice(start,start+data.pageSize);return{items,page:data.page,pageSize:data.pageSize,total,hasMore:start+items.length<total};});
export const relatedProductsQuery=(category:string)=>queryOptions({queryKey:["mp","products","related",category],queryFn:()=>getProducts({data:{category,page:1}}),staleTime:60_000});
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const getProduct=createServerFn({method:"GET"}).inputValidator((input:unknown)=>z.object({id:z.string()}).parse(input)).handler(async({data})=>{const identifier=data.id.trim();const isUuid=UUID_RE.test(identifier);if(!isUuid&&!SLUG_RE.test(identifier))return{kind:"notFound"} as ProductDetailResult;const{supabaseAdmin}=await import("@/integrations/supabase/client.server");const PRODUCT_COLUMNS:string="id,slug,title,category,subcategory,product_type,delivery_contents,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at,ai_review_status,ai_review_score,status,published,is_preorder,release_date,released_at,preorder_note,admin_notes,file_path,preview_pages,seo_title,seo_description,seo_image_alt,seo_og_title,seo_og_description,seo_robots_index,seo_robots_follow";let{data:row}=await supabaseAdmin.from("marketplace_products").select(PRODUCT_COLUMNS).eq(isUuid?"id":"slug",identifier).maybeSingle().overrideTypes<DbProductRow,{merge:false}>();if(!row&&!isUuid){let productId:string|null=null;try{const{data:resolved}=await(supabaseAdmin as unknown as{rpc:(fn:string,args:Record<string,string>)=>Promise<{data:string|null}>}).rpc("resolve_product_slug_redirect",{_old_slug:identifier});productId=typeof resolved==="string"&&resolved?resolved:null;}catch{productId=null;}if(productId){const{data:target}=await supabaseAdmin.from("marketplace_products").select(PRODUCT_COLUMNS).eq("id",productId).maybeSingle().overrideTypes<DbProductRow,{merge:false}>();row=target??null;}}if(!row)return{kind:"notFound"} as ProductDetailResult;if(row.status!=="approved"||!row.published)return{kind:"unpublished",title:row.title} as ProductDetailResult;const canonicalSegment=canonicalProductSegment(row);if(shouldRedirectProductRequest(identifier,canonicalSegment))return{kind:"redirect",slug:canonicalSegment} as ProductDetailResult;const product=dbRowToProduct(row);const[agg,creators]=await Promise.all([fetchReviewAggregates(supabaseAdmin,[product.id]),fetchCreatorInfoMap(supabaseAdmin,[product.creator.id])]);const enriched=applyCreatorInfo(applyAggregates([product],agg),creators)[0];const breakdown:ProductRatingBreakdown={1:0,2:0,3:0,4:0,5:0};const reviews:ProductReviewSnippet[]=[];try{const{data:rev}=await supabaseAdmin.from("product_reviews").select("id,reviewer_name,rating,title,body,created_at").eq("product_id",product.id).order("created_at",{ascending:false}).limit(20);for(const r of(rev??[]) as Array<{id:string;reviewer_name:string|null;rating:number;title:string|null;body:string;created_at:string}>){const key=Math.max(1,Math.min(5,Math.round(r.rating))) as 1|2|3|4|5;breakdown[key]+=1;reviews.push({id:r.id,author:r.reviewer_name?.trim()||"AurumVault reader",rating:r.rating,title:r.title,body:r.body,createdAt:r.created_at});}}catch{}return{kind:"published",product:enriched,reviews,ratingBreakdown:breakdown} as ProductDetailResult;});

export const getFeaturedCreators=createServerFn({method:"GET"}).handler(async()=>{const fallback=mockCreators(6);const data=await safeFetch<unknown>("/creators/featured",fallback as unknown);return(Array.isArray(data)&&data.length?(data as Creator[]):fallback) as Creator[];});
export type HomeHighlights={heroProduct:Product|null;illustriousProductCount:number};
export const getHomeHighlights=createServerFn({method:"GET"}).handler(async():Promise<HomeHighlights>=>{try{const supa=serverSupabase();const[heroRes,countRes]=await Promise.all([supa.from("marketplace_products").select("id,slug,title,category,price_cents,cover_url,description,seller_id,created_at").eq("status","approved").eq("published",true).ilike("title","Kingdom Mind").maybeSingle(),supa.from("marketplace_products").select("id",{count:"exact",head:true}).eq("status","approved").eq("published",true).eq("seller_id","02579d2f-e0c1-4f53-b0e8-abedf18e4d4f")]);let heroProduct=heroRes.data?dbRowToProduct(heroRes.data as DbProductRow):null;if(heroProduct){const[agg,creators]=await Promise.all([fetchReviewAggregates(supa,[heroProduct.id]),fetchCreatorInfoMap(supa,[heroProduct.creator.id])]);heroProduct=applyCreatorInfo(applyAggregates([heroProduct],agg),creators)[0];}return{heroProduct,illustriousProductCount:countRes.count??0};}catch{return{heroProduct:null,illustriousProductCount:0};}});
export const getNewReleasesRowFn=createServerFn({method:"GET"}).handler(async():Promise<Product[]>=>(await fetchDbProducts()).slice(0,8));
export const getPromotedPicksRowFn=createServerFn({method:"GET"}).handler(async():Promise<Product[]>=>{try{const supa=serverSupabase();const{data}=await supa.from("marketplace_products").select("id,slug,title,category,price_cents,compare_at_price_cents,cover_url,description,seller_id,created_at").eq("status","approved").eq("published",true).eq("featured",true).order("created_at",{ascending:false});if(data&&data.length>0){const products=(data as DbProductRow[]).map(dbRowToProduct);const agg=await fetchReviewAggregates(supa,products.map((p)=>p.id));return rotateDaily(applyAggregates(products,agg),2).slice(0,8);}}catch{}return rotateDaily(await fetchDbProducts(),2).slice(0,8);});
export const getRecommendedRowFn=createServerFn({method:"GET"}).handler(async():Promise<Product[]>=>rotateDaily(await fetchDbProducts(),3).slice(0,8));
export type AffiliatePick={id:string;title:string;price:number|null;source:string|null;affiliateUrl:string;imageUrl:string|null;badge:string|null};
export const getKingdomPicksRowFn=createServerFn({method:"GET"}).handler(async():Promise<AffiliatePick[]>=>{try{const supa=serverSupabase();const{data,error}=await supa.from("affiliate_products").select("id,title,price,source,affiliate_url,image_url,badge,featured,created_at").eq("active",true).order("featured",{ascending:false}).order("created_at",{ascending:false}).limit(60);if(error||!data)return[];const pool=data.map((r)=>({id:r.id as string,title:r.title as string,price:r.price!=null?Number(r.price):null,source:(r.source as string|null)??null,affiliateUrl:r.affiliate_url as string,imageUrl:(r.image_url as string|null)??null,badge:(r.badge as string|null)??null}));return rotateHalfDay(pool,3,8);}catch{return[];}});