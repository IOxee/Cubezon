import { Fragment, type ReactNode } from "react";

/**
 * Fills {name} placeholders of an i18n template with React nodes (links, command chips…).
 * Unknown placeholders are left as they are, like fmt().
 */
export function RichText({ template, values }: { template: string; values: Record<string, ReactNode> }) {
  return (
    <>
      {template.split(/(\{\w+\})/g).map((part, index) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        if (key !== undefined && key in values) return <Fragment key={index}>{values[key]}</Fragment>;
        return part ? <Fragment key={index}>{part}</Fragment> : null;
      })}
    </>
  );
}

/** In-game command as a keyboard key, e.g. /cz link. */
export function Command({ children }: { children: ReactNode }) {
  return <code className="cmd">{children}</code>;
}
