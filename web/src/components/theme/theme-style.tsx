import { getCurrentThemeCss } from "@/lib/data/themes";

/**
 * CSS of the superadmin theme in force (nothing for the base theme). Cached and tagged
 * "theme", so it is part of the static shell: no flash, and updateTag("theme") refreshes it.
 */
export async function ThemeStyle() {
  const css = await getCurrentThemeCss();
  if (!css) return null;
  return <style id="cz-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
