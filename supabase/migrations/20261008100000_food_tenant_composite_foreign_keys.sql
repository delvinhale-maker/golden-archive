-- Enforce tenant identity across traceability references at the database boundary.
create unique index if not exists food_items_tenant_id_uidx on public.food_items(organization_id,id);
create unique index if not exists food_facilities_tenant_id_uidx on public.food_facilities(organization_id,id);
create unique index if not exists food_lots_tenant_id_uidx on public.food_traceability_lots(organization_id,id);
create unique index if not exists food_shipments_tenant_id_uidx on public.food_shipments(organization_id,id);
alter table public.food_traceability_lots
 add constraint food_lots_item_tenant_fk foreign key(organization_id,item_id) references public.food_items(organization_id,id),
 add constraint food_lots_facility_tenant_fk foreign key(organization_id,facility_id) references public.food_facilities(organization_id,id);
alter table public.food_lot_relationships
 add constraint food_relationship_parent_tenant_fk foreign key(organization_id,parent_lot_id) references public.food_traceability_lots(organization_id,id),
 add constraint food_relationship_child_tenant_fk foreign key(organization_id,child_lot_id) references public.food_traceability_lots(organization_id,id);
alter table public.food_shipment_items
 add constraint food_shipment_item_lot_tenant_fk foreign key(organization_id,lot_id) references public.food_traceability_lots(organization_id,id),
 add constraint food_shipment_item_shipment_tenant_fk foreign key(organization_id,shipment_id) references public.food_shipments(organization_id,id);