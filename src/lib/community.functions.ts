import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID = z.string().uuid();

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  unread: boolean;
};

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Announcement[]> => {
    const [{ data: rows }, { data: reads }] = await Promise.all([
      context.supabase
        .from("creator_announcements")
        .select("id,title,body,pinned,created_at")
        .eq("published", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      context.supabase
        .from("creator_announcement_reads")
        .select("announcement_id")
        .eq("user_id", context.userId),
    ]);
    const readSet = new Set((reads ?? []).map((r) => r.announcement_id));
    return (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      pinned: r.pinned,
      createdAt: r.created_at,
      unread: !readSet.has(r.id),
    }));
  });

export const markAnnouncementRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { announcementId: string }) => ({
    announcementId: UUID.parse(d.announcementId),
  }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("creator_announcement_reads")
      .upsert(
        { user_id: context.userId, announcement_id: data.announcementId },
        { onConflict: "user_id,announcement_id" },
      );
    return { ok: true };
  });

export const countUnreadAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: rows }, { data: reads }] = await Promise.all([
      context.supabase
        .from("creator_announcements")
        .select("id")
        .eq("published", true),
      context.supabase
        .from("creator_announcement_reads")
        .select("announcement_id")
        .eq("user_id", context.userId),
    ]);
    const readSet = new Set((reads ?? []).map((r) => r.announcement_id));
    const unread = (rows ?? []).filter((r) => !readSet.has(r.id)).length;
    return { unread };
  });

// Admin fns
export const adminCreateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string; pinned?: boolean }) => ({
    title: z.string().trim().min(1).max(200).parse(d.title),
    body: z.string().trim().max(10000).parse(d.body),
    pinned: !!d.pinned,
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("creator_announcements")
      .insert({
        title: data.title,
        body: data.body,
        pinned: data.pinned,
        published: true,
        author_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: UUID.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    await context.supabase.from("creator_announcements").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------
export type ForumPost = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  category: "question" | "win" | "feedback";
  status: "pending" | "approved" | "hidden";
  likesCount: number;
  replyCount: number;
  createdAt: string;
  likedByMe: boolean;
};

async function attachProfiles(
  supa: ReturnType<typeof publicSupabase>,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await supa
    .from("profiles")
    .select("id,display_name")
    .in("id", ids);
  for (const p of (data ?? []) as Array<{ id: string; display_name: string | null }>) {
    map.set(p.id, p.display_name ?? "Creator");
  }
  return map;
}

export const listForumPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { category?: "question" | "win" | "feedback"; mineOnly?: boolean } = {}) =>
      ({ category: d.category, mineOnly: !!d.mineOnly }),
  )
  .handler(async ({ data, context }): Promise<ForumPost[]> => {
    let q = context.supabase
      .from("creator_forum_posts")
      .select(
        "id,author_id,title,body,category,status,likes_count,reply_count,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.mineOnly) {
      q = q.eq("author_id", context.userId);
    } else {
      q = q.eq("status", "approved");
    }
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const [{ data: myLikes }, profiles] = await Promise.all([
      ids.length
        ? context.supabase
            .from("creator_forum_likes")
            .select("post_id")
            .eq("user_id", context.userId)
            .in("post_id", ids)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
      attachProfiles(
        publicSupabase(),
        Array.from(new Set((rows ?? []).map((r) => r.author_id))),
      ),
    ]);
    const likedSet = new Set((myLikes ?? []).map((l) => l.post_id));

    return (rows ?? []).map((r) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: profiles.get(r.author_id) ?? "Creator",
      title: r.title,
      body: r.body,
      category: r.category as ForumPost["category"],
      status: r.status as ForumPost["status"],
      likesCount: r.likes_count,
      replyCount: r.reply_count,
      createdAt: r.created_at,
      likedByMe: likedSet.has(r.id),
    }));
  });

export const createForumPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { title: string; body: string; category: "question" | "win" | "feedback" }) => ({
      title: z.string().trim().min(3).max(200).parse(d.title),
      body: z.string().trim().min(1).max(8000).parse(d.body),
      category: z.enum(["question", "win", "feedback"]).parse(d.category),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("creator_forum_posts")
      .insert({
        author_id: context.userId,
        title: data.title,
        body: data.body,
        category: data.category,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const toggleForumLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; like: boolean }) => ({
    postId: UUID.parse(d.postId),
    like: !!d.like,
  }))
  .handler(async ({ data, context }) => {
    if (data.like) {
      await context.supabase
        .from("creator_forum_likes")
        .upsert(
          { user_id: context.userId, post_id: data.postId },
          { onConflict: "user_id,post_id" },
        );
    } else {
      await context.supabase
        .from("creator_forum_likes")
        .delete()
        .eq("user_id", context.userId)
        .eq("post_id", data.postId);
    }
    return { ok: true };
  });

export type ForumReply = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export const listForumReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => ({ postId: UUID.parse(d.postId) }))
  .handler(async ({ data, context }): Promise<ForumReply[]> => {
    const { data: rows, error } = await context.supabase
      .from("creator_forum_replies")
      .select("id,author_id,body,created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const profiles = await attachProfiles(
      publicSupabase(),
      Array.from(new Set((rows ?? []).map((r) => r.author_id))),
    );
    return (rows ?? []).map((r) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: profiles.get(r.author_id) ?? "Creator",
      body: r.body,
      createdAt: r.created_at,
    }));
  });

export const createForumReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; body: string }) => ({
    postId: UUID.parse(d.postId),
    body: z.string().trim().min(1).max(4000).parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("creator_forum_replies")
      .insert({
        post_id: data.postId,
        author_id: context.userId,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// Admin moderation
export const adminListPendingPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data } = await context.supabase
      .from("creator_forum_posts")
      .select("id,author_id,title,body,category,status,created_at")
      .in("status", ["pending", "hidden"])
      .order("created_at", { ascending: false })
      .limit(100);
    const profiles = await attachProfiles(
      publicSupabase(),
      Array.from(new Set((data ?? []).map((r) => r.author_id))),
    );
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category as ForumPost["category"],
      status: r.status as ForumPost["status"],
      createdAt: r.created_at,
      authorId: r.author_id,
      authorName: profiles.get(r.author_id) ?? "Creator",
    }));
  });

export const adminSetPostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "hidden" }) => ({
    id: UUID.parse(d.id),
    status: z.enum(["approved", "hidden"]).parse(d.status),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    await context.supabase
      .from("creator_forum_posts")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: true };
  });
