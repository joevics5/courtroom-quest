-- Signed-out visitors (the anon role) have nothing to spend or read. Guests are signed in anonymously, so they use the authenticated role.
REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_credit_status() FROM anon;
