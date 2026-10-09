-- current_theme: a theme active by hand now applies whenever no scheduled theme is inside its
-- window, even if it also has a schedule of its own (before, only themes without a schedule
-- could be active by hand). A scheduled theme inside its window still wins.

create or replace view public.current_theme
    with (security_invoker = false)
as
select id, name, tokens
from public.themes
where (starts_at is not null and starts_at <= now() and now() < ends_at)
   or is_active
order by (starts_at is not null and starts_at <= now() and now() < ends_at) desc, starts_at desc nulls last
limit 1;
