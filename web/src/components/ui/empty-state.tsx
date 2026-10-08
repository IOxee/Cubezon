import type { ReactNode } from "react";
import { ItemIcon } from "./item-icon";

/** Empty list or page: icon, title, short (dry) explanation and an optional action. */
export function EmptyState({
  title,
  body,
  icon = "bundle",
  action,
}: {
  title: string;
  body?: ReactNode;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="squares p-3">
        <ItemIcon material={icon} size={48} />
      </span>
      <h2 className="text-xl">{title}</h2>
      {body ? <p className="max-w-md text-ink-2">{body}</p> : null}
      {action}
    </div>
  );
}
