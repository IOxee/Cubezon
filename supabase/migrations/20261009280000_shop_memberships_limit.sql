-- Cubezon: in how many shops a player may work (as an employee in shop_members).
-- Global limit: plugin_settings 'max_shop_memberships' (config.yml shops.max-memberships, published
-- by the plugin at startup; 1 if missing). Own shops are limited separately (shop slots).
-- Enforced here for every client: plugin, web and any other.

create function public.max_shop_memberships() returns integer
    language sql
    stable
    set search_path = ''
as $$
    select coalesce(
        (select case when value ~ '^[0-9]{1,3}$' then value::integer end
         from public.plugin_settings where key = 'max_shop_memberships'),
        1);
$$;

-- Limit, shops the player works in and free places (for the web and the plugin).
create function public.shop_memberships_of(p_player uuid)
    returns table (max_memberships integer, used integer, free integer)
    language sql
    stable
    security definer
    set search_path = ''
as $$
    select m.max_memberships, u.used, greatest(m.max_memberships - u.used, 0)
    from (select public.max_shop_memberships() as max_memberships) m,
         (select count(*)::integer as used from public.shop_members where player_uuid = p_player) u;
$$;

revoke all on function public.shop_memberships_of(uuid) from public, anon;
grant execute on function public.shop_memberships_of(uuid) to authenticated, service_role;

create function public.check_shop_memberships() returns trigger
    language plpgsql
    set search_path = ''
as $$
declare
    v_used integer;
    v_max  integer := public.max_shop_memberships();
begin
    -- One hire at a time per player, so two shops cannot both take the last place.
    perform pg_advisory_xact_lock(hashtext('members:' || new.player_uuid::text));
    select count(*) into v_used from public.shop_members m
    where m.player_uuid = new.player_uuid and m.shop_id <> new.shop_id;
    if v_used >= v_max then
        raise exception 'SHOP_MEMBERSHIPS_EXCEEDED: works in % of % shops', v_used, v_max
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger shop_members_check_limit
    before insert or update of player_uuid on public.shop_members
    for each row execute function public.check_shop_memberships();
