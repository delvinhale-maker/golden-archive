create or replace function public.food_lot_genealogy(p_lot uuid,p_direction text default 'both')
returns table(lot_id uuid,depth integer,direction text)
language sql security invoker stable set search_path='' as $$
with recursive walk(lot_id,depth,direction,path,org_id) as (
 select l.id,0,'self'::text,array[l.id],l.organization_id
 from public.food_traceability_lots l
 where l.id=p_lot and public.is_assurance_member(l.organization_id)
 union all
 select edge.next_id,w.depth+1,edge.direction,w.path||edge.next_id,w.org_id
 from walk w
 join lateral (
   select r.child_lot_id as next_id,'downstream'::text as direction
   from public.food_lot_relationships r
   where r.parent_lot_id=w.lot_id and r.organization_id=w.org_id
     and p_direction in('both','downstream') and w.direction in('self','downstream')
   union all
   select r.parent_lot_id as next_id,'upstream'::text as direction
   from public.food_lot_relationships r
   where r.child_lot_id=w.lot_id and r.organization_id=w.org_id
     and p_direction in('both','upstream') and w.direction in('self','upstream')
 ) edge on true
 join public.food_traceability_lots next_lot on next_lot.id=edge.next_id and next_lot.organization_id=w.org_id
 where w.depth<50 and not edge.next_id=any(w.path)
)
select distinct w.lot_id,w.depth,w.direction from walk w
$$;
revoke all on function public.food_lot_genealogy(uuid,text) from public;
grant execute on function public.food_lot_genealogy(uuid,text) to authenticated;
