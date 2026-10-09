-- Cubezon: how many shops each player may have.
--   Default: plugin_settings 'default_shop_slots' (config.yml shops.default-slots, published by the
--            plugin at startup; 1 if missing).
--   Per player: players.shop_slots overrides it (set by an OP in-game with /cz shop settings slots, or by a
--            superadmin on the web). null = use the default.
-- A shop uses a slot unless it was REJECTED. The limit is enforced here, for every client.

alter table public.players
    add column shop_slots integer check (shop_slots between 0 and 100);

create function public.default_shop_slots() returns integer
    language sql
    stable
    set search_path = ''
as $$
    select coalesce(
        (select case when value ~ '^[0-9]{1,3}$' then value::integer end
         from public.plugin_settings where key = 'default_shop_slots'),
        1);
$$;

-- Slots, shops using them and free slots of a player (for the web and the plugin).
create function public.shop_slots_of(p_player uuid)
    returns table (slots integer, used integer, free integer, custom boolean)
    language sql
    stable
    security definer
    set search_path = ''
as $$
    with limits as (
        select coalesce(p.shop_slots, public.default_shop_slots()) as slots, p.shop_slots is not null as custom
        from public.players p where p.uuid = p_player
    ), usage as (
        select count(*)::integer as used from public.shops s
        where s.owner_uuid = p_player and s.status <> 'REJECTED'
    )
    select l.slots, u.used, greatest(l.slots - u.used, 0), l.custom from limits l, usage u;
$$;

revoke all on function public.shop_slots_of(uuid) from public, anon;
grant execute on function public.shop_slots_of(uuid) to authenticated, service_role;

create function public.check_shop_slots() returns trigger
    language plpgsql
    set search_path = ''
as $$
declare
    v_slots integer;
    v_used  integer;
begin
    if new.status = 'REJECTED' then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.owner_uuid = old.owner_uuid and old.status <> 'REJECTED' then
        return new; -- Same owner and already counted: nothing changes.
    end if;
    -- One shop at a time per owner, so two requests cannot both take the last slot.
    perform pg_advisory_xact_lock(hashtext(new.owner_uuid::text));
    select coalesce(p.shop_slots, public.default_shop_slots()) into v_slots
    from public.players p where p.uuid = new.owner_uuid;
    select count(*) into v_used from public.shops s
    where s.owner_uuid = new.owner_uuid and s.status <> 'REJECTED' and s.id <> new.id;
    if v_used >= coalesce(v_slots, public.default_shop_slots()) then
        raise exception 'SHOP_SLOTS_EXCEEDED: % of % shop slots used', v_used, v_slots
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger shops_check_slots
    before insert or update of owner_uuid, status on public.shops
    for each row execute function public.check_shop_slots();
