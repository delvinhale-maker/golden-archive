
CREATE TABLE public.cover_audit_alert_config (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold INT NOT NULL DEFAULT 1,
  cooldown_minutes INT NOT NULL DEFAULT 60,
  recipient_email TEXT,
  webhook_url TEXT,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton_row CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.cover_audit_alert_config TO authenticated;
GRANT ALL ON public.cover_audit_alert_config TO service_role;

ALTER TABLE public.cover_audit_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alert config"
  ON public.cover_audit_alert_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert alert config"
  ON public.cover_audit_alert_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update alert config"
  ON public.cover_audit_alert_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_cover_audit_alert_config_updated_at
  BEFORE UPDATE ON public.cover_audit_alert_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.cover_audit_alert_config (id, enabled, threshold, cooldown_minutes)
VALUES (1, true, 1, 60)
ON CONFLICT (id) DO NOTHING;
