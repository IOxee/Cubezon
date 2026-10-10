-- Cubezon: shop ranks (roles) with permissions.
-- The owner always has every permission. Each shop has its own roles (created from the defaults the
-- plugin publishes in plugin_settings 'default_shop_roles', from config.yml roles.defaults); every
-- employee (shop_members) has one. Exactly one role per shop is the default given to new hires.
-- Permissions:
--   orders.decide    accept / reject orders          orders.package  print packages
--   stock.deposit    deposit stock                   stock.withdraw  withdraw unsold stock
--   products.manage  create / edit products, samples staff.manage    hire, fire, assign roles
--   storage.buy      buy storage blocks and computers

create function public.shop_permission_list() returns text[]
    language sql
    immutable
as $$
    select array['orders.decide', 'orders.package', 'stock.deposit', 'stock.withdraw',
                 'products.manage', 'staff.manage', 'storage.buy']::text[];
$$;

create table public.shop_roles (
    id          uuid primary key default gen_random_uuid(),
    shop_id     uuid        not null references public.shops (id) on delete cascade,
    name        text        not null check (char_length(name) between 1 and 24),
    position    integer     not null default 0,
    permissions text[]      not null default '{}' check (permissions <@ public.shop_permission_list()),
    is_default  boolean     not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index shop_roles_name_idx on public.shop_roles (shop_id, lower(name));
create unique index shop_roles_default_idx on public.shop_roles (shop_id) where is_default;
create index shop_roles_shop_idx on public.shop_roles (shop_id, position);

create trigger shop_roles_set_updated_at
    before update on public.shop_roles
    for each row execute function public.set_updated_at();

alter table public.shop_roles enable row level security;
-- No policies: only the plugin and the web server (secret key).

alter table public.shop_members
    add column role_id uuid references public.shop_roles (id) on delete set null;

-- Defaults for new shops

create function public.default_shop_roles_json() returns jsonb
    language plpgsql
    stable
    set search_path = ''
as $$
declare
    v_json jsonb;
begin
    begin
        select value::jsonb into v_json from public.plugin_settings where key = 'default_shop_roles';
    exception when others then
        v_json := null;
    end;
    if v_json is null or jsonb_typeof(v_json) <> 'array' or jsonb_array_length(v_json) = 0 then
        v_json := '[
          {"name": "Gerente", "permissions": ["orders.decide", "orders.package", "stock.deposit", "stock.withdraw", "products.manage", "staff.manage", "storage.buy"]},
          {"name": "Empleado", "default": true, "permissions": ["orders.decide", "orders.package", "stock.deposit"]},
          {"name": "Repartidor", "permissions": ["orders.package"]}
        ]'::jsonb;
    end if;
    return v_json;
end;
$$;

-- Creates the default roles of a shop that has none (idempotent). Unknown permissions are dropped.
create function public.ensure_shop_roles(p_shop uuid) returns void
    language plpgsql
    security definer
    set search_path = ''
as $$
begin
    if exists (select 1 from public.shop_roles where shop_id = p_shop) then
        return;
    end if;
    insert into public.shop_roles (shop_id, name, position, permissions, is_default)
    select p_shop,
           left(r.value ->> 'name', 24),
           r.ordinality::integer,
           coalesce(array(select p from jsonb_array_elements_text(r.value -> 'permissions') p
                          where p = any (public.shop_permission_list())), '{}'),
           coalesce((r.value ->> 'default')::boolean, false)
    from jsonb_array_elements(public.default_shop_roles_json()) with ordinality r
    where coalesce(r.value ->> 'name', '') <> ''
    on conflict do nothing;
    -- Exactly one default role: the first flagged one, else the last one.
    if not exists (select 1 from public.shop_roles where shop_id = p_shop and is_default) then
        update public.shop_roles set is_default = true
        where id = (select id from public.shop_roles where shop_id = p_shop order by position desc limit 1);
    end if;
end;
$$;

create function public.create_default_shop_roles() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    perform public.ensure_shop_roles(new.id);
    return new;
end;
$$;

create trigger shops_create_default_roles
    after insert on public.shops
    for each row execute function public.create_default_shop_roles();

-- New hires get the shop's default role.
create function public.default_member_role() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if new.role_id is null then
        perform public.ensure_shop_roles(new.shop_id);
        select id into new.role_id from public.shop_roles where shop_id = new.shop_id and is_default;
    end if;
    return new;
end;
$$;

create trigger shop_members_default_role
    before insert on public.shop_members
    for each row execute function public.default_member_role();

-- A role must belong to the member's shop.
create function public.check_member_role_shop() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if new.role_id is not null
       and not exists (select 1 from public.shop_roles r where r.id = new.role_id and r.shop_id = new.shop_id) then
        raise exception 'ROLE_OF_ANOTHER_SHOP' using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger shop_members_check_role_shop
    before insert or update of role_id, shop_id on public.shop_members
    for each row execute function public.check_member_role_shop();

-- Deleting a role moves its members to the default role; the default role cannot be deleted.
create function public.reassign_deleted_role() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    if old.is_default and exists (select 1 from public.shops s where s.id = old.shop_id) then
        raise exception 'DEFAULT_ROLE_CANNOT_BE_DELETED' using errcode = 'check_violation';
    end if;
    update public.shop_members m
    set role_id = (select id from public.shop_roles r where r.shop_id = old.shop_id and r.is_default and r.id <> old.id)
    where m.role_id = old.id;
    return old;
end;
$$;

create trigger shop_roles_reassign_on_delete
    before delete on public.shop_roles
    for each row execute function public.reassign_deleted_role();

-- Roles per shop (plugin_settings 'max_shop_roles', from config.yml roles.max-per-shop; 10 if missing).
create function public.check_shop_roles_limit() returns trigger
    language plpgsql
    set search_path = ''
as $$
declare
    v_max integer := coalesce(
        (select case when value ~ '^[0-9]{1,3}$' then value::integer end
         from public.plugin_settings where key = 'max_shop_roles'), 10);
begin
    if (select count(*) from public.shop_roles where shop_id = new.shop_id) >= v_max then
        raise exception 'SHOP_ROLES_EXCEEDED: % roles max', v_max using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger shop_roles_check_limit
    before insert on public.shop_roles
    for each row execute function public.check_shop_roles_limit();

-- Permission checks (plugin and web)

-- Every permission for the owner; the role's for an employee; null for anybody else.
create function public.shop_permissions_of(p_shop uuid, p_player uuid) returns text[]
    language sql
    stable
    security definer
    set search_path = ''
as $$
    select case
        when exists (select 1 from public.shops s where s.id = p_shop and s.owner_uuid = p_player)
            then public.shop_permission_list()
        else (select coalesce(r.permissions, '{}') from public.shop_members m
              left join public.shop_roles r on r.id = m.role_id
              where m.shop_id = p_shop and m.player_uuid = p_player)
    end;
$$;

create function public.shop_member_can(p_shop uuid, p_player uuid, p_permission text) returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as $$
    select coalesce(p_permission = any (public.shop_permissions_of(p_shop, p_player)), false);
$$;

revoke all on function public.shop_permissions_of(uuid, uuid) from public, anon;
revoke all on function public.shop_member_can(uuid, uuid, text) from public, anon;
revoke all on function public.ensure_shop_roles(uuid) from public, anon;
grant execute on function public.shop_permissions_of(uuid, uuid) to authenticated, service_role;
grant execute on function public.shop_member_can(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.ensure_shop_roles(uuid) to service_role;

-- Existing shops and employees

select public.ensure_shop_roles(id) from public.shops;

update public.shop_members m
set role_id = (select r.id from public.shop_roles r where r.shop_id = m.shop_id and r.is_default)
where m.role_id is null;
