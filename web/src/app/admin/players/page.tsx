import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable, td, th } from "@/components/admin/data-table";
import { fill } from "@/components/admin/fill";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination, firstParam, parsePage } from "@/components/admin/pagination";
import { TableSkeleton } from "@/components/admin/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m, plural } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import {
  PLAYER_SLOTS_PAGE_SIZE,
  searchPlayerSlots,
  type PlayerShopSlots,
  type PluginShopSettings,
} from "@/lib/data/shop-slots";
import { formatInteger } from "@/lib/format";
import { isOverShopSlots, SHOP_SLOTS } from "@/lib/seller/shops";
import { setShopSlotsAction } from "./actions";

export const metadata: Metadata = { title: m.admin.players.title };

const t = m.admin.players;

/** Longest Minecraft name: the search box accepts no more. */
const NAME_MAX = 16;

type SearchParams = PageProps<"/admin/jugadores">["searchParams"];

/** Superadmin only: even the title waits for the role check, so admins just get a 404. */
export default function AdminPlayersPage(props: PageProps<"/admin/jugadores">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Players searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Players({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("SUPERADMIN");
  const params = await searchParams;
  const q = firstParam(params.q).trim().slice(0, NAME_MAX);
  const customOnly = firstParam(params.propios) === "1";
  const page = parsePage(params.pagina);

  const { players, total, settings } = await searchPlayerSlots({ q, customOnly, page });
  const filtered = Boolean(q || customOnly);

  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <SlotsInfo settings={settings} />
      <Filters q={q} customOnly={customOnly} />
      <p className="mb-2 text-sm text-ink-2" role="status">
        {plural(total, t.results)}
      </p>

      {players.length === 0 ? (
        <EmptyState
          icon="name_tag"
          title={filtered ? t.empty.title : t.emptyAll.title}
          body={filtered ? t.empty.body : t.emptyAll.body}
        />
      ) : (
        <DataTable caption={t.title}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t.columns.name}</th>
              <th scope="col" className={`${th} text-right`}>{t.columns.shops}</th>
              <th scope="col" className={th}>{t.columns.kind}</th>
              <th scope="col" className={`${th} text-right`}>{t.columns.memberships}</th>
              <th scope="col" className={th}>{t.columns.change}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <PlayerRow key={player.uuid} player={player} maxMemberships={settings.maxMemberships} />
            ))}
          </tbody>
        </DataTable>
      )}

      <Pagination
        page={page}
        pageCount={Math.ceil(total / PLAYER_SLOTS_PAGE_SIZE)}
        basePath="/admin/jugadores"
        params={{ q, propios: customOnly ? "1" : "" }}
      />
    </>
  );
}

/** One read-only setting of the plugin: its value and the config.yml key that sets it. */
function Setting({
  text,
  value,
}: {
  text: { label: string; value: { one: string; other: string }; hint: string; key: string };
  value: number;
}) {
  return (
    <div>
      <dt className="label">{text.label}</dt>
      <dd className="mt-1">
        <span className="num block text-xl font-semibold">{plural(value, text.value)}</span>
        <span className="block text-sm text-ink-2">{text.hint}</span>
        <code className="num mt-1 block text-xs text-ink-3">{text.key}</code>
      </dd>
    </div>
  );
}

/** Global settings (read-only: they come from the plugin's config.yml) and the in-game command. */
function SlotsInfo({ settings }: { settings: PluginShopSettings }) {
  return (
    <section className="mb-5 grid gap-3 md:grid-cols-2">
      <div className="card-soft p-4">
        <h2 className="label">{t.settings.title}</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <Setting text={t.settings.defaultSlots} value={settings.defaultSlots} />
          <Setting text={t.settings.maxMemberships} value={settings.maxMemberships} />
        </dl>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">{t.settings.note}</p>
      </div>
      <div className="card-soft p-4">
        <h2 className="label">{t.help.title}</h2>
        <p className="mt-2 text-sm text-ink-2">
          {fill(t.help.body, { command: <span className="cmd">{t.help.command}</span> })}
        </p>
        <p className="mt-2 text-sm text-ink-2">{t.help.lower}</p>
      </div>
    </section>
  );
}

function Filters({ q, customOnly }: { q: string; customOnly: boolean }) {
  return (
    // Keyed by the filters so "clear" also empties the fields.
    <Form
      key={`${q}|${customOnly}`}
      action="/admin/jugadores"
      role="search"
      aria-label={t.filters.label}
      className="mb-4 flex flex-wrap items-end gap-2"
    >
      <div className="min-w-48 flex-1">
        <label htmlFor="players-q" className="label">
          {t.filters.search}
        </label>
        <input
          id="players-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={NAME_MAX}
          autoComplete="off"
          spellCheck={false}
          placeholder={t.filters.placeholder}
          className="input num mt-1 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 self-center pt-5 text-sm">
        <input type="checkbox" name="propios" value="1" defaultChecked={customOnly} className="accent-ink" />
        {t.filters.customOnly}
      </label>
      <button type="submit" className="btn btn-ink">
        {t.filters.submit}
      </button>
      {q || customOnly ? (
        <Link href="/admin/jugadores" className="btn btn-ghost">
          {t.filters.clear}
        </Link>
      ) : null}
    </Form>
  );
}

function PlayerRow({ player, maxMemberships }: { player: PlayerShopSlots; maxMemberships: number }) {
  const inputId = `slots-${player.uuid}`;
  return (
    <tr>
      <td className={`${td} font-semibold`}>{player.name}</td>
      <td className={`${td} text-right`}>
        <span className="num whitespace-nowrap">
          {fmt(t.usage, { used: formatInteger(player.used), slots: formatInteger(player.slots) })}
        </span>
        {isOverShopSlots(player) ? (
          <span className="block text-xs font-semibold text-danger">{t.over}</span>
        ) : null}
      </td>
      <td className={td}>
        <span className={`badge ${player.custom ? "badge-ink" : "badge-paper"}`}>
          {player.custom ? t.custom : t.default}
        </span>
      </td>
      <td className={`${td} num text-right whitespace-nowrap`}>
        {fmt(t.membershipsUsage, { used: formatInteger(player.memberships), max: formatInteger(maxMemberships) })}
      </td>
      <td className={td}>
        <div className="flex flex-wrap items-start gap-2">
          <ActionForm action={setShopSlotsAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="playerUuid" value={player.uuid} />
            <label htmlFor={inputId} className="sr-only">
              {fmt(t.slotsLabel, { name: player.name })}
            </label>
            <input
              id={inputId}
              name="slots"
              type="number"
              required
              min={SHOP_SLOTS.min}
              max={SHOP_SLOTS.max}
              step={1}
              inputMode="numeric"
              defaultValue={player.slots}
              className="input num w-20 text-sm"
            />
            <SubmitButton className="btn btn-sm" pendingLabel={t.saving}>
              {t.set}
            </SubmitButton>
          </ActionForm>
          {player.custom ? (
            <ActionForm action={setShopSlotsAction}>
              <input type="hidden" name="playerUuid" value={player.uuid} />
              <input type="hidden" name="slots" value="reset" />
              <SubmitButton className="btn btn-sm btn-ghost" pendingLabel={t.saving}>
                {t.reset}
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
