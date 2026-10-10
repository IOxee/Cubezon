-- Web: change the default role of a shop (the one new hires get) in a single transaction. The
-- partial unique index shop_roles_default_idx allows one default per shop, so the old one is
-- cleared before the new one is set. Only the web server calls it (secret key), after checking
-- that the player is the shop's owner.

create function public.set_default_shop_role(p_shop uuid, p_role uuid) returns boolean
    language plpgsql
    security definer
    set search_path = ''
as $$
begin
    if not exists (select 1 from public.shop_roles where id = p_role and shop_id = p_shop) then
        return false;
    end if;
    update public.shop_roles set is_default = false where shop_id = p_shop and is_default and id <> p_role;
    update public.shop_roles set is_default = true where id = p_role and not is_default;
    return true;
end;
$$;

revoke all on function public.set_default_shop_role(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_default_shop_role(uuid, uuid) to service_role;
