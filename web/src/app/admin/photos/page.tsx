import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination, parsePage } from "@/components/admin/pagination";
import { TableSkeleton } from "@/components/admin/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, m, plural } from "@/i18n";
import { requireStaff } from "@/lib/auth/session";
import { LISTING_PHOTOS_PAGE_SIZE, listListingPhotos, type AdminListingPhoto } from "@/lib/data/admin-photos";
import { formatDate } from "@/lib/format";
import { listingPhotoUrl } from "@/lib/listing-photos";
import { removeListingPhotoAction } from "./actions";

export const metadata: Metadata = { title: m.admin.photos.title };

const t = m.admin.photos;

/** Product photos, newest first: any staff member can take one down. */
export default function AdminPhotosPage(props: PageProps<"/admin/photos">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Photos searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Photos({ searchParams }: { searchParams: PageProps<"/admin/photos">["searchParams"] }) {
  await requireStaff();
  const page = parsePage((await searchParams).page);
  const { photos, total } = await listListingPhotos(page);
  return (
    <>
      <AdminPageHeader title={t.title} intro={t.intro} />
      <p className="mb-3 text-sm text-ink-2" role="status">
        {plural(total, t.results)}
      </p>
      {photos.length === 0 ? (
        <EmptyState icon="painting" title={t.empty.title} body={t.empty.body} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.listingId}>
              <PhotoCard photo={photo} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / LISTING_PHOTOS_PAGE_SIZE)} basePath="/admin/photos" params={{}} />
    </>
  );
}

function PhotoCard({ photo }: { photo: AdminListingPhoto }) {
  const url = listingPhotoUrl(photo.photoPath);
  return (
    <article className="card flex h-full flex-col">
      <div className="squares relative aspect-square overflow-hidden">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user image from the public bucket
          <img src={url} alt={fmt(m.catalog.media.photoAlt, { title: photo.title })} className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h2 className="line-clamp-2 font-semibold">{photo.title}</h2>
        <p className="text-xs text-ink-2">
          {fmt(t.by, { shop: photo.shop.name, date: photo.uploadedAt ? formatDate(photo.uploadedAt) : "—" })}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {photo.shop.status === "APPROVED" ? (
            <Link href={`/p/${photo.listingId}`} className="btn btn-sm">
              {t.view}
            </Link>
          ) : null}
          <ActionForm action={removeListingPhotoAction} confirm={t.confirm} inline>
            <input type="hidden" name="listingId" value={photo.listingId} />
            <SubmitButton pendingLabel={t.removing} className="btn btn-sm btn-ghost">
              {t.remove}
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </article>
  );
}
