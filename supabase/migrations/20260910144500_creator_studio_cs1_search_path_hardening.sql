-- AurumVault Creator Studio™ — CS1 advisor hardening
-- The transition helper is pure SQL and needs no schema lookup.
alter function public.creator_studio_valid_transition(text, text)
  set search_path = '';
