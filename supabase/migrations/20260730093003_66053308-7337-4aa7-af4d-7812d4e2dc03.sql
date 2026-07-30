ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.agent_memory ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE INDEX IF NOT EXISTS conversations_client_id_idx ON public.conversations (client_id);
CREATE INDEX IF NOT EXISTS agent_memory_client_id_idx ON public.agent_memory (client_id);