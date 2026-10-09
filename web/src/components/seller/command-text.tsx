import { Fragment } from "react";

/** Renders a message, drawing its {command} placeholder as a game command key chip. */
export function CommandText({ text, command }: { text: string; command: string }) {
  return (
    <>
      {text.split("{command}").map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <kbd className="cmd">{command}</kbd> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}
