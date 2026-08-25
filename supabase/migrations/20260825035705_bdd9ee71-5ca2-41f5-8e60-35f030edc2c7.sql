REVOKE ALL ON public.qr_projects FROM anon;
REVOKE ALL ON public.qr_scan_events FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.qr_scan_events FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.qr_projects FROM authenticated;