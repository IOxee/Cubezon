-- «Tienda Cubezon» kiosks: blocks an admin registers in the game (/cz kiosk create, looking at the
-- block). Right click opens a menu to buy storage blocks, company computers and mailboxes with game
-- money. Only the plugin reads and writes this table (no policies, RLS on).

create table public.kiosks (
    id         uuid primary key default gen_random_uuid(),
    world      text        not null,
    x          integer     not null,
    y          integer     not null,
    z          integer     not null,
    created_by uuid        not null,
    created_at timestamptz not null default now(),
    unique (world, x, y, z)
);

comment on table public.kiosks is 'Cubezon shop kiosks placed by admins in the game (buy storage, computers, mailboxes).';
comment on column public.kiosks.created_by is 'Admin who registered it (no foreign key: admins need not be linked players).';

alter table public.kiosks enable row level security;
