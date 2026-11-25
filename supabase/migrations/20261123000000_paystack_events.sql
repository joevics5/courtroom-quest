/*
  # Paystack: turn webhook events into subscriptions and payments

  apply_paystack_event(event, pro_plan_code) is called by the paystack-webhook edge function (service role only)
  AFTER it has verified Paystack's signature. All the rules live here so they can be tested without Paystack:

    charge.success         record the payment (a repeated event is ignored); if it is a charge on the Pro plan,
                           the player is Pro for that plan's period (a month)
    subscription.create    remember the subscription code and when it renews
    subscription.not_renew the player cancelled: Pro stays until the paid period ends
    subscription.disable   the subscription ended: Pro ends with the paid period
    invoice.payment_failed a renewal failed: marked past_due (still Pro until the period ends)
    refund.processed       the payment is marked refunded (nothing is taken away automatically)
    anything else          ignored

  The player is found from the user id we put in the checkout (metadata.user_id), else from the customer code a
  previous payment saved, else from the email the checkout used.
*/

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS email_token text;

CREATE OR REPLACE FUNCTION public._paystack_find_user(p_metadata jsonb, p_customer_code text, p_email text, p_sub_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid;
BEGIN
  IF p_sub_code IS NOT NULL THEN
    SELECT user_id INTO uid FROM public.subscriptions WHERE provider = 'paystack' AND provider_subscription_id = p_sub_code;
    IF uid IS NOT NULL THEN RETURN uid; END IF;
  END IF;

  IF p_metadata ? 'user_id' AND (p_metadata->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO uid FROM auth.users WHERE id = (p_metadata->>'user_id')::uuid;
    IF uid IS NOT NULL THEN RETURN uid; END IF;
  END IF;

  IF p_customer_code IS NOT NULL THEN
    SELECT user_id INTO uid FROM public.subscriptions WHERE provider = 'paystack' AND provider_customer_id = p_customer_code;
    IF uid IS NOT NULL THEN RETURN uid; END IF;
  END IF;

  IF p_email IS NOT NULL AND p_email <> '' THEN
    SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(p_email) AND COALESCE(is_anonymous, false) = false ORDER BY created_at LIMIT 1;
  END IF;
  RETURN uid;
END;
$$;
REVOKE ALL ON FUNCTION public._paystack_find_user(jsonb, text, text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._paystack_interval(p_interval text)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_interval, 'monthly'))
    WHEN 'hourly' THEN interval '1 hour'
    WHEN 'daily' THEN interval '1 day'
    WHEN 'weekly' THEN interval '7 days'
    WHEN 'monthly' THEN interval '1 month'
    WHEN 'quarterly' THEN interval '3 months'
    WHEN 'biannually' THEN interval '6 months'
    WHEN 'annually' THEN interval '1 year'
    ELSE interval '1 month' END
$$;

CREATE OR REPLACE FUNCTION public.apply_paystack_event(p_event jsonb, p_pro_plan_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  ev text := p_event->>'event';
  d jsonb := COALESCE(p_event->'data', '{}'::jsonb);
  customer_code text := d#>>'{customer,customer_code}';
  email text := d#>>'{customer,email}';
  meta jsonb := CASE WHEN jsonb_typeof(d->'metadata') = 'object' THEN d->'metadata' ELSE '{}'::jsonb END;
  plan_code text := COALESCE(d#>>'{plan,plan_code}', d#>>'{subscription,plan,plan_code}');
  sub_code text := COALESCE(d->>'subscription_code', d#>>'{subscription,subscription_code}');
  uid uuid;
  is_pro_charge boolean;
  paid timestamptz;
  pay_id uuid;
  new_end timestamptz;
BEGIN
  IF p_pro_plan_code IS NULL OR p_pro_plan_code = '' THEN
    RAISE EXCEPTION 'The Pro plan code is not configured';
  END IF;

  IF ev = 'charge.success' THEN
    IF COALESCE(d->>'status', 'success') <> 'success' THEN RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'not successful'); END IF;
    uid := public._paystack_find_user(meta, customer_code, email, sub_code);
    is_pro_charge := plan_code IS NOT NULL AND plan_code = p_pro_plan_code;
    paid := COALESCE((d->>'paid_at')::timestamptz, now());

    INSERT INTO public.payments (user_id, provider, provider_payment_id, kind, amount_minor, currency, status, paid_at, period_start, period_end, raw)
    VALUES (uid, 'paystack', COALESCE(d->>'id', d->>'reference'), CASE WHEN is_pro_charge THEN 'subscription' ELSE 'other' END,
            COALESCE((d->>'amount')::integer, 0), COALESCE(d->>'currency', 'NGN'), 'succeeded', paid,
            CASE WHEN is_pro_charge THEN paid END,
            CASE WHEN is_pro_charge THEN paid + public._paystack_interval(d#>>'{plan,interval}') END,
            jsonb_build_object('reference', d->>'reference', 'plan_code', plan_code, 'customer_code', customer_code))
    ON CONFLICT (provider, provider_payment_id) DO NOTHING
    RETURNING id INTO pay_id;

    IF pay_id IS NULL THEN RETURN jsonb_build_object('handled', true, 'event', ev, 'note', 'duplicate'); END IF;
    IF NOT is_pro_charge THEN RETURN jsonb_build_object('handled', true, 'event', ev, 'note', 'not the Pro plan', 'user_id', uid); END IF;
    IF uid IS NULL THEN RETURN jsonb_build_object('handled', true, 'event', ev, 'note', 'payment recorded, player not found'); END IF;

    new_end := paid + public._paystack_interval(d#>>'{plan,interval}');
    INSERT INTO public.subscriptions (user_id, plan, status, provider, provider_customer_id, current_period_start, current_period_end, cancel_at_period_end)
    VALUES (uid, 'pro', 'active', 'paystack', customer_code, paid, new_end, false)
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'active', provider = 'paystack',
          provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, public.subscriptions.provider_customer_id),
          current_period_start = paid, current_period_end = new_end, updated_at = now();
    RETURN jsonb_build_object('handled', true, 'event', ev, 'user_id', uid, 'pro_until', new_end);

  ELSIF ev = 'subscription.create' THEN
    IF plan_code IS DISTINCT FROM p_pro_plan_code THEN RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'not the Pro plan'); END IF;
    uid := public._paystack_find_user(meta, customer_code, email, sub_code);
    IF uid IS NULL THEN RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'player not found'); END IF;
    INSERT INTO public.subscriptions (user_id, plan, status, provider, provider_customer_id, provider_subscription_id, email_token, current_period_end)
    VALUES (uid, 'pro', 'active', 'paystack', customer_code, sub_code, d->>'email_token', (d->>'next_payment_date')::timestamptz)
    ON CONFLICT (user_id) DO UPDATE
      SET provider = 'paystack', provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, public.subscriptions.provider_customer_id),
          provider_subscription_id = EXCLUDED.provider_subscription_id, email_token = EXCLUDED.email_token,
          current_period_end = COALESCE(EXCLUDED.current_period_end, public.subscriptions.current_period_end),
          updated_at = now();
    RETURN jsonb_build_object('handled', true, 'event', ev, 'user_id', uid);

  ELSIF ev = 'subscription.not_renew' THEN
    uid := public._paystack_find_user(meta, customer_code, email, sub_code);
    IF uid IS NULL THEN RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'player not found'); END IF;
    UPDATE public.subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE user_id = uid AND provider = 'paystack';
    RETURN jsonb_build_object('handled', true, 'event', ev, 'user_id', uid);

  ELSIF ev = 'subscription.disable' THEN
    uid := public._paystack_find_user(meta, customer_code, email, sub_code);
    IF uid IS NULL THEN RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'player not found'); END IF;
    -- Paid time is kept: Pro simply runs out when the paid period does. If that has already happened, end it now.
    UPDATE public.subscriptions
    SET cancel_at_period_end = true,
        status = CASE WHEN current_period_end IS NULL OR current_period_end <= now() THEN 'canceled' ELSE status END,
        updated_at = now()
    WHERE user_id = uid AND provider = 'paystack';
    RETURN jsonb_build_object('handled', true, 'event', ev, 'user_id', uid);

  ELSIF ev = 'invoice.payment_failed' THEN
    uid := public._paystack_find_user(meta, customer_code, email, sub_code);
    IF uid IS NULL THEN RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'player not found'); END IF;
    UPDATE public.subscriptions SET status = 'past_due', updated_at = now()
    WHERE user_id = uid AND provider = 'paystack' AND status = 'active';
    RETURN jsonb_build_object('handled', true, 'event', ev, 'user_id', uid);

  ELSIF ev = 'refund.processed' THEN
    UPDATE public.payments SET status = 'refunded'
    WHERE provider = 'paystack' AND raw->>'reference' = COALESCE(d->>'transaction_reference', d#>>'{transaction,reference}');
    RETURN jsonb_build_object('handled', true, 'event', ev);
  END IF;

  RETURN jsonb_build_object('handled', false, 'event', ev, 'note', 'ignored');
END;
$$;
REVOKE ALL ON FUNCTION public.apply_paystack_event(jsonb, text) FROM public, anon, authenticated;
