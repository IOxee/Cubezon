import { Fragment, type ReactNode } from "react";

/** Like fmt(), but the placeholders become React nodes: fill("Usa {cmd}", { cmd: <Cmd /> }). */
export function fill(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null;
    return <Fragment key={i}>{key !== null && key in nodes ? nodes[key] : part}</Fragment>;
  });
}
