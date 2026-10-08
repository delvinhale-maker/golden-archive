create or replace function private.enforce_food_review_separation()
returns trigger language plpgsql set search_path to '' as $$
declare actor uuid := auth.uid(); owner_user uuid; prior_verifier uuid; actor_role text;
begin
 if new.entity_type <> 'corrective_action' then raise exception 'unsupported review entity type'; end if;
 select owner_id into owner_user from public.food_corrective_actions where id=new.entity_id and organization_id=new.organization_id;
 if not found then raise exception 'review entity must belong to organization'; end if;
 if tg_op='UPDATE' then
  if (old.organization_id,old.entity_type,old.entity_id,old.review_type) is distinct from (new.organization_id,new.entity_type,new.entity_id,new.review_type) then raise exception 'review identity is immutable'; end if;
  if old.status <> 'pending' and new.status is distinct from old.status then raise exception 'completed review decision is immutable'; end if;
 end if;
 if new.status in ('approved','rejected') and (tg_op='INSERT' or old.status='pending') then
  if actor is null or new.reviewer_id is distinct from actor then raise exception 'reviewer must be current user'; end if;
  select role into actor_role from public.assurance_memberships where organization_id=new.organization_id and user_id=actor;
  if new.review_type='verification' then
   if actor_role not in ('owner','compliance_admin','independent_reviewer') or actor_role is null then raise exception 'independent reviewer role required'; end if;
   if owner_user=actor then raise exception 'action owner cannot independently verify own action'; end if;
  elsif new.review_type='approval' then
   if actor_role not in ('owner','compliance_admin','approver') or actor_role is null then raise exception 'approver role required'; end if;
   if new.status='approved' then
    select reviewer_id into prior_verifier from public.food_assurance_reviews where organization_id=new.organization_id and entity_type=new.entity_type and entity_id=new.entity_id and review_type='verification' and status='approved' order by reviewed_at desc nulls last limit 1;
    if prior_verifier is null then raise exception 'approval requires independent verification'; end if;
    if prior_verifier=actor then raise exception 'verifier cannot approve same closure'; end if;
   end if;
  end if;
  new.reviewed_at=now();
 elsif new.status='pending' then
  if new.reviewer_id is not null or new.reviewed_at is not null then raise exception 'pending reviews cannot claim reviewer identity'; end if;
 end if;
 return new;
end $$;