CREATE OR REPLACE FUNCTION public.admin_decide_payout_request(_request_id uuid, _approve boolean, _method text DEFAULT NULL, _admin_note text DEFAULT NULL, _mark_paid boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE _r public.payout_requests%ROWTYPE; _payout_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _r FROM public.payout_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'request already decided'; END IF;
  IF NOT _approve THEN
    UPDATE public.payout_requests SET status='rejected',admin_note=_admin_note,decided_by=auth.uid(),decided_at=now() WHERE id=_request_id;
    INSERT INTO public.notifications(user_id,type,title,body,link,metadata)
    VALUES (_r.seller_id,'payout_request','Payout request declined',COALESCE(_admin_note,'Your payout request was declined.'),'/dashboard/earnings',jsonb_build_object('request_id',_request_id));
    RETURN NULL;
  END IF;
  IF _mark_paid THEN
    _payout_id := public.admin_record_seller_payout(_r.seller_id,_r.amount_cents,_method,_admin_note);
    UPDATE public.payout_requests SET status='paid',admin_note=_admin_note,seller_payout_id=_payout_id,decided_by=auth.uid(),decided_at=now() WHERE id=_request_id;
  ELSE
    UPDATE public.payout_requests SET status='approved',admin_note=_admin_note,decided_by=auth.uid(),decided_at=now() WHERE id=_request_id;
  END IF;
  INSERT INTO public.notifications(user_id,type,title,body,link,metadata)
  VALUES (_r.seller_id,'payout_request',CASE WHEN _mark_paid THEN 'Payout sent' ELSE 'Payout approved' END,
          format('Your payout of $%.2f has been %s.',(_r.amount_cents/100.0),CASE WHEN _mark_paid THEN 'sent' ELSE 'approved' END),
          '/dashboard/earnings',jsonb_build_object('request_id',_request_id,'seller_payout_id',_payout_id));
  RETURN _payout_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_rename_subcategory(_category_slug text,_old_name text,_new_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden: admin role required'; END IF;
  IF _new_name IS NULL OR length(btrim(_new_name))=0 THEN RAISE EXCEPTION 'new name is required'; END IF;
  UPDATE public.product_subcategories SET name=btrim(_new_name) WHERE category_slug=_category_slug AND name=_old_name;
  UPDATE public.marketplace_products SET subcategory=btrim(_new_name) WHERE category::text=_category_slug AND subcategory=_old_name;
END $$;

CREATE OR REPLACE FUNCTION public.affiliate_commissions_guard_creator_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE _is_admin boolean;
BEGIN
  SELECT COALESCE(public.has_role(auth.uid(),'admin'::public.app_role),false) INTO _is_admin;
  IF _is_admin THEN RETURN NEW; END IF;
  IF NEW.affiliate_user_id IS DISTINCT FROM OLD.affiliate_user_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.commission_cents IS DISTINCT FROM OLD.commission_cents
     OR NEW.sale_amount_cents IS DISTINCT FROM OLD.sale_amount_cents
     OR NEW.commission_rate_pct IS DISTINCT FROM OLD.commission_rate_pct
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Creators can only update status on affiliate_commissions';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.assign_founding_creator(_user_id uuid,_application_id uuid DEFAULT NULL,_lead_id uuid DEFAULT NULL,_campaign_source text DEFAULT NULL,_accepted_by uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE _existing integer; _next integer;
BEGIN
  SELECT founding_number INTO _existing FROM public.founding_creators WHERE user_id=_user_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('founding_creators_assign'));
  SELECT COALESCE(MAX(founding_number),0)+1 INTO _next FROM public.founding_creators;
  IF _next>100 THEN RAISE EXCEPTION 'Founding 100 cohort is full'; END IF;
  INSERT INTO public.founding_creators(user_id,founding_number,seller_application_id,lead_id,campaign_source,accepted_by)
  VALUES (_user_id,_next,_application_id,_lead_id,_campaign_source,_accepted_by);
  RETURN _next;
END $$;

CREATE OR REPLACE FUNCTION public.brand_slug_normalize(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(_v),'[^a-z0-9]+','-','g'),'-{2,}','-','g'),'-');
$$;

CREATE OR REPLACE FUNCTION public.check_creator_lead_rate_limit(_ip_hash text,_max_per_hour integer DEFAULT 5)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE recent integer;
BEGIN
  IF _ip_hash IS NULL OR length(_ip_hash)<8 THEN RETURN false; END IF;
  DELETE FROM public.creator_lead_rate_limits WHERE created_at < now()-interval '24 hours';
  SELECT count(*) INTO recent FROM public.creator_lead_rate_limits WHERE ip_hash=_ip_hash AND created_at > now()-interval '1 hour';
  IF recent >= greatest(_max_per_hour,1) THEN RETURN false; END IF;
  INSERT INTO public.creator_lead_rate_limits(ip_hash) VALUES (_ip_hash);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.creator_affiliates_guard_creator_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.affiliate_user_id IS DISTINCT FROM OLD.affiliate_user_id OR NEW.referral_code IS DISTINCT FROM OLD.referral_code OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Creators can only update status on creator_affiliates';
  END IF;
  IF OLD.status='banned' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Banned affiliates cannot be reactivated by creators'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.creator_leads_link_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE _email text;
BEGIN
  _email := lower(btrim(coalesce(NEW.applicant_email,'')));
  IF _email='' THEN RETURN NEW; END IF;
  UPDATE public.creator_leads SET
    seller_application_id=NEW.id,
    application_submitted_at=coalesce(application_submitted_at,NEW.created_at),
    converted_to_creator_at=CASE WHEN NEW.status='approved' THEN coalesce(converted_to_creator_at,now()) ELSE converted_to_creator_at END,
    lead_status=CASE WHEN NEW.status='approved' THEN 'CREATOR_ACTIVE' ELSE 'APPLICATION_SUBMITTED' END
  WHERE normalized_email=_email;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.get_creator_follower_count(_creator_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT count(*)::int FROM public.creator_followers WHERE creator_user_id=_creator_user_id;
$$;

CREATE OR REPLACE FUNCTION public.log_marketplace_publish_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_event text;
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.product_publish_history(product_id,seller_id,event,from_published,to_published,from_status,to_status,actor_id)
    VALUES (NEW.id,NEW.seller_id,'created',NULL,NEW.published,NULL,NEW.status::text,auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.published IS DISTINCT FROM OLD.published OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := CASE NEW.status::text WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' WHEN 'pending' THEN 'submitted' ELSE 'status_changed' END;
    ELSIF NEW.published AND NOT COALESCE(OLD.published,false) THEN v_event:='republished';
    ELSIF COALESCE(OLD.published,false) AND NOT NEW.published THEN v_event:='unpublished';
    ELSE v_event:='updated'; END IF;
    INSERT INTO public.product_publish_history(product_id,seller_id,event,from_published,to_published,from_status,to_status,actor_id)
    VALUES (NEW.id,NEW.seller_id,v_event,OLD.published,NEW.published,OLD.status::text,NEW.status::text,auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_products_normalize_title()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN IF NEW.title IS NOT NULL THEN NEW.title:=btrim(regexp_replace(NEW.title,'\s+',' ','g')); END IF; RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.marketplace_products_slugify(_title text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_title,'')),'[^a-z0-9]+','-','g'));
$$;

CREATE OR REPLACE FUNCTION public.marketplace_products_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.slug IS NULL OR length(trim(NEW.slug))=0 THEN NEW.slug:=public.marketplace_products_slugify(NEW.title); ELSE NEW.slug:=public.marketplace_products_slugify(NEW.slug); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.record_creator_referral(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE _uid uuid:=auth.uid(); _referrer uuid;
BEGIN
  IF _uid IS NULL OR _code IS NULL OR length(_code)<6 THEN RETURN false; END IF;
  SELECT id INTO _referrer FROM auth.users WHERE upper(replace(id::text,'-','')) LIKE upper(_code)||'%' LIMIT 1;
  IF _referrer IS NULL OR _referrer=_uid THEN RETURN false; END IF;
  INSERT INTO public.creator_referrals(referrer_user_id,referred_user_id,code) VALUES (_referrer,_uid,upper(_code)) ON CONFLICT (referred_user_id) DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_payout(_amount_cents bigint,_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE _uid uuid:=auth.uid(); _pending bigint; _currency text; _snapshot jsonb; _req_id uuid; _open int; _has_tax int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount_cents IS NULL OR _amount_cents<2500 THEN RAISE EXCEPTION 'minimum payout is $25'; END IF;
  SELECT count(*) INTO _open FROM public.payout_requests WHERE seller_id=_uid AND status IN ('pending','approved');
  IF _open>0 THEN RAISE EXCEPTION 'you already have an open payout request'; END IF;
  SELECT count(*) INTO _has_tax FROM public.creator_tax_forms WHERE seller_id=_uid AND status<>'rejected';
  IF _has_tax=0 THEN RAISE EXCEPTION 'submit a W-9 or W-8BEN tax form before requesting payouts'; END IF;
  SELECT pending_cents,currency INTO _pending,_currency FROM public.seller_balances WHERE seller_id=_uid FOR UPDATE;
  IF _pending IS NULL THEN RAISE EXCEPTION 'no balance found'; END IF;
  IF _amount_cents>_pending THEN RAISE EXCEPTION 'requested amount exceeds pending balance'; END IF;
  SELECT to_jsonb(m)-'created_at'-'updated_at' INTO _snapshot FROM public.creator_payout_methods m WHERE seller_id=_uid;
  IF _snapshot IS NULL THEN RAISE EXCEPTION 'add a payout method before requesting'; END IF;
  INSERT INTO public.payout_requests(seller_id,amount_cents,currency,seller_note,method_snapshot)
  VALUES (_uid,_amount_cents,COALESCE(_currency,'usd'),_note,_snapshot) RETURNING id INTO _req_id;
  INSERT INTO public.notifications(user_id,type,title,body,link,metadata)
  SELECT ur.user_id,'payout_request','New payout request',format('Creator requested $%.2f',(_amount_cents/100.0)),'/admin/payouts',jsonb_build_object('request_id',_req_id,'seller_id',_uid,'amount_cents',_amount_cents)
  FROM public.user_roles ur WHERE ur.role='admin';
  RETURN _req_id;
END $$;

CREATE OR REPLACE FUNCTION public.run_slug_integrity_check()
RETURNS public.slug_integrity_alerts LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_missing int; v_dupes int; v_title_dupes int; v_dupe_examples jsonb; v_title_dupe_examples jsonb; v_index boolean; v_title_index boolean; v_status text; v_row public.slug_integrity_alerts; v_admin record;
BEGIN
  SELECT count(*) INTO v_missing FROM public.marketplace_products WHERE slug IS NULL OR length(trim(slug))=0;
  WITH dupes AS (SELECT seller_id,slug,count(*) AS n FROM public.marketplace_products WHERE status<>'rejected' AND slug IS NOT NULL AND length(trim(slug))>0 GROUP BY seller_id,slug HAVING count(*)>1)
  SELECT count(*),COALESCE(jsonb_agg(jsonb_build_object('seller_id',seller_id,'slug',slug,'count',n)) FILTER (WHERE seller_id IS NOT NULL),'[]'::jsonb) INTO v_dupes,v_dupe_examples FROM dupes;
  WITH title_dupes AS (SELECT seller_id,lower(btrim(title)) AS norm_title,count(*) AS n FROM public.marketplace_products WHERE status<>'rejected' GROUP BY seller_id,lower(btrim(title)) HAVING count(*)>1)
  SELECT count(*),COALESCE(jsonb_agg(jsonb_build_object('seller_id',seller_id,'title',norm_title,'count',n)) FILTER (WHERE seller_id IS NOT NULL),'[]'::jsonb) INTO v_title_dupes,v_title_dupe_examples FROM title_dupes;
  SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='marketplace_products' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(seller_id, slug)%' AND indexdef ILIKE '%status%rejected%') INTO v_index;
  SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='marketplace_products' AND indexname='marketplace_products_seller_title_unique') INTO v_title_index;
  v_status:=CASE WHEN NOT v_index OR NOT v_title_index OR v_dupes>0 OR v_title_dupes>0 THEN 'fail' WHEN v_missing>0 THEN 'warn' ELSE 'ok' END;
  INSERT INTO public.slug_integrity_alerts(status,missing_slug_count,duplicate_group_count,index_present,details)
  VALUES (v_status,v_missing,v_dupes+v_title_dupes,v_index AND v_title_index,jsonb_build_object('duplicates',v_dupe_examples,'title_duplicates',v_title_dupe_examples,'slug_index_present',v_index,'title_index_present',v_title_index)) RETURNING * INTO v_row;
  IF v_status<>'ok' THEN
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role='admin' LOOP
      INSERT INTO public.notifications(user_id,type,title,body,link,metadata)
      VALUES (v_admin.user_id,'slug_integrity','Product integrity '||v_status,format('Missing slugs: %s · Duplicate slug groups: %s · Duplicate title groups: %s · Indexes present: slug=%s title=%s',v_missing,v_dupes,v_title_dupes,v_index,v_title_index),'/admin',jsonb_build_object('alert_id',v_row.id,'missing_slug_count',v_missing,'duplicate_slug_group_count',v_dupes,'duplicate_title_group_count',v_title_dupes,'slug_index_present',v_index,'title_index_present',v_title_index,'duplicates',v_dupe_examples,'title_duplicates',v_title_dupe_examples));
    END LOOP;
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.seller_applications_guard_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes OR NEW.admin_feedback IS DISTINCT FROM OLD.admin_feedback OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.reapply_after IS DISTINCT FROM OLD.reapply_after OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Only admins can modify application review fields';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.seller_applications_guard_brand_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE reserved text[]:=ARRAY['admin','support','aurumvault','aurum-vault','checkout','login','logout','creators','creator','account','marketplace','store','stores','auth','api','cart','library','dashboard','products','bundles','academy','search','sell'];
BEGIN
  IF NEW.brand_slug IS NULL OR btrim(NEW.brand_slug)='' THEN NEW.brand_slug:=NULL; RETURN NEW; END IF;
  NEW.brand_slug:=public.brand_slug_normalize(NEW.brand_slug);
  IF char_length(coalesce(NEW.brand_slug,''))<3 THEN RAISE EXCEPTION 'Storefront address must be at least 3 characters'; END IF;
  IF NEW.brand_slug=ANY(reserved) THEN RAISE EXCEPTION 'Storefront address "%" is reserved by AurumVault',NEW.brand_slug; END IF;
  IF EXISTS (SELECT 1 FROM public.seller_applications s WHERE s.brand_slug=NEW.brand_slug AND s.user_id<>NEW.user_id) THEN RAISE EXCEPTION 'Storefront address "%" is already taken',NEW.brand_slug; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_preview_pages()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.preview_pages IS NULL THEN NEW.preview_pages:='{}'; END IF;
  IF array_length(NEW.preview_pages,1)>5 THEN RAISE EXCEPTION 'preview_pages: max 5 pages'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.preview_pages) p WHERE p<1) THEN RAISE EXCEPTION 'preview_pages: page numbers must be >= 1'; END IF;
  IF (SELECT count(*)<>count(DISTINCT p) FROM unnest(NEW.preview_pages) p) THEN RAISE EXCEPTION 'preview_pages: pages must be unique'; END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_decide_payout_request(uuid,boolean,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_payout_request(uuid,boolean,text,text,boolean) TO authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.admin_rename_subcategory(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_rename_subcategory(text,text,text) TO authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.assign_founding_creator(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_founding_creator(uuid,uuid,uuid,text,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_creator_lead_rate_limit(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_creator_lead_rate_limit(text,integer) TO anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.get_creator_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_follower_count(uuid) TO anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.record_creator_referral(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_creator_referral(text) TO authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.request_payout(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_payout(bigint,text) TO authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.run_slug_integrity_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_slug_integrity_check() TO service_role;
REVOKE EXECUTE ON FUNCTION public.affiliate_commissions_guard_creator_update(),public.creator_affiliates_guard_creator_update(),public.creator_leads_link_application(),public.log_marketplace_publish_change(),public.seller_applications_guard_admin_fields() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS trg_affiliate_commissions_guard_update ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commissions_guard_update BEFORE UPDATE ON public.affiliate_commissions FOR EACH ROW EXECUTE FUNCTION public.affiliate_commissions_guard_creator_update();
DROP TRIGGER IF EXISTS trg_creator_affiliates_guard_update ON public.creator_affiliates;
CREATE TRIGGER trg_creator_affiliates_guard_update BEFORE UPDATE ON public.creator_affiliates FOR EACH ROW EXECUTE FUNCTION public.creator_affiliates_guard_creator_update();
DROP TRIGGER IF EXISTS creator_leads_link_application_trg ON public.seller_applications;
CREATE TRIGGER creator_leads_link_application_trg AFTER INSERT OR UPDATE OF status ON public.seller_applications FOR EACH ROW EXECUTE FUNCTION public.creator_leads_link_application();
DROP TRIGGER IF EXISTS marketplace_products_normalize_title_trg ON public.marketplace_products;
CREATE TRIGGER marketplace_products_normalize_title_trg BEFORE INSERT OR UPDATE OF title ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.marketplace_products_normalize_title();
DROP TRIGGER IF EXISTS trg_log_publish_change ON public.marketplace_products;
CREATE TRIGGER trg_log_publish_change AFTER INSERT OR UPDATE OF published,status ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.log_marketplace_publish_change();
DROP TRIGGER IF EXISTS trg_marketplace_products_set_slug ON public.marketplace_products;
CREATE TRIGGER trg_marketplace_products_set_slug BEFORE INSERT OR UPDATE OF title,slug ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.marketplace_products_set_slug();
DROP TRIGGER IF EXISTS validate_preview_pages_trg ON public.marketplace_products;
CREATE TRIGGER validate_preview_pages_trg BEFORE INSERT OR UPDATE OF preview_pages ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.validate_preview_pages();
DROP TRIGGER IF EXISTS seller_applications_brand_slug_guard ON public.seller_applications;
CREATE TRIGGER seller_applications_brand_slug_guard BEFORE INSERT OR UPDATE OF brand_slug ON public.seller_applications FOR EACH ROW EXECUTE FUNCTION public.seller_applications_guard_brand_slug();
DROP TRIGGER IF EXISTS seller_applications_guard_admin_fields_trg ON public.seller_applications;
CREATE TRIGGER seller_applications_guard_admin_fields_trg BEFORE UPDATE ON public.seller_applications FOR EACH ROW EXECUTE FUNCTION public.seller_applications_guard_admin_fields();