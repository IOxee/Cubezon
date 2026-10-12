-- Security hardening before the repo goes public.
--
-- These SECURITY DEFINER lookups answer for any player UUID with no caller check. The web
-- only calls them with the secret key (service_role) and the plugin with its own Postgres
-- role, and no RLS policy depends on them, so `authenticated` never needed them. Keeping the
-- grant meant that anyone able to mint an authenticated JWT (e.g. with Supabase Auth sign-ups
-- left on) could enumerate any player's shop slots, employment and permissions.

revoke execute on function public.shop_slots_of(uuid) from authenticated;
revoke execute on function public.shop_memberships_of(uuid) from authenticated;
revoke execute on function public.shop_permissions_of(uuid, uuid) from authenticated;
revoke execute on function public.shop_member_can(uuid, uuid, text) from authenticated;
