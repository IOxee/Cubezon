-- The web team page now lets a superadmin demote or remove anyone, themselves included. The one
-- thing never allowed: leaving the staff without a superadmin (nobody could manage it again).
-- Checked here, with the rows locked, so two superadmins demoting each other at once cannot both win.

create function public.staff_keep_superadmin() returns trigger
    language plpgsql
as
$$
begin
    if old.role = 'SUPERADMIN' and (tg_op = 'DELETE' or new.role <> 'SUPERADMIN') then
        perform 1 from public.staff where role = 'SUPERADMIN' for update;
        if not exists (select 1 from public.staff where role = 'SUPERADMIN' and player_uuid <> old.player_uuid) then
            raise exception 'LAST_SUPERADMIN' using errcode = 'P0001';
        end if;
    end if;
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger staff_keep_superadmin
    before update of role or delete on public.staff
    for each row execute function public.staff_keep_superadmin();
