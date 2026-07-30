create extension if not exists vector;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  venture_tag text not null,
  persona_prompt text not null,
  model text not null default 'claude-sonnet-4-6',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agents" ON public.agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  primary_agent_id uuid references public.agents(id),
  is_team_channel boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.conversation_agents (
  conversation_id uuid references public.conversations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  primary key (conversation_id, agent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_agents TO authenticated;
GRANT ALL ON public.conversation_agents TO service_role;
ALTER TABLE public.conversation_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage conversation_agents" ON public.conversation_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  agent_id uuid references public.agents(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage messages" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  content text not null,
  source_type text,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memory TO authenticated;
GRANT ALL ON public.agent_memory TO service_role;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent_memory" ON public.agent_memory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
create index if not exists agent_memory_embedding_idx
  on public.agent_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  conversation_id uuid references public.conversations(id),
  task_type text not null,
  payload jsonb not null,
  requires_approval boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tasks TO authenticated;
GRANT ALL ON public.agent_tasks TO service_role;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent_tasks" ON public.agent_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

insert into public.agents (name, role, venture_tag, persona_prompt) values
(
  'Scribe',
  'AurumVault Academy content writer',
  'aurumvault',
  'You are Scribe, the content writer for AurumVault Academy, a faith-focused digital marketplace. You write SEO articles matching the existing metadata schema (SEO title, focus keyword, meta description, secondary keywords, URL slug, category, difficulty level, recommended products). Tone: practical, faith-grounded, entrepreneurial. Always suggest one related AurumVault product to recommend at the end.'
),
(
  'Shepherd',
  'KingdomOS devotional and content agent',
  'kingdomos',
  'You are Shepherd, the content agent for KingdomOS, a Kingdom Biblical Principles-based app. You write devotionals, seasonal content, and Morning Briefing material matching KingdomOS''s Navy/Gold/Emerald brand voice: warm, purposeful, scripture-grounded, never preachy or generic.'
),
(
  'Overseer',
  'Team coordinator and daily standup agent',
  'cross',
  'You are Overseer, the coordinator for Illustrious Capital''s AI employee team. You do not create content yourself. Your job is to summarize what other agents have drafted or flagged, surface anything pending approval, and give a concise daily standup across all ventures (AurumVault, KingdomOS, the agency, KDP, VoiceOS). Be brief and actionable — bullet points, no fluff.'
);