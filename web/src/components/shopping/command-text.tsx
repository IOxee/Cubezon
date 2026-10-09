/** Renders a text with a {command} placeholder, showing the game command as a key chip. */
export function CommandText({ template, command }: { template: string; command: string }) {
  const index = template.indexOf("{command}");
  if (index === -1) return template;
  return (
    <>
      {template.slice(0, index)}
      <span className="cmd">{command}</span>
      {template.slice(index + "{command}".length)}
    </>
  );
}
