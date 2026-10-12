"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import type { ActionState } from "@/components/admin/action-form";
import { Stamp } from "@/components/ui/stamp";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmt, plural } from "@/i18n";
import { useLocale, useMessages } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/locales";
import { isoToZoneLocal } from "@/lib/theme/schedule";
import {
  BASE_TOKENS,
  MODES,
  TOKEN_KEYS,
  checkContrast,
  normalizeHex,
  resolveTokens,
  sanitizeTokens,
  type Mode,
  type ThemeTokens,
  type TokenKey,
  type TokenSet,
} from "@/lib/theme/tokens";

const IDLE: ActionState = { status: "idle", message: "" };

export type ThemeEditorInitial = {
  name: string;
  tokens: ThemeTokens;
  startsAt: string | null;
  endsAt: string | null;
};

/** CSS variables for a preview box: the subtree renders with this theme. */
function previewStyle(set: TokenSet): CSSProperties {
  return Object.fromEntries(TOKEN_KEYS.map((key) => [`--${key}`, set[key]])) as CSSProperties;
}

/**
 * Theme form: a color per token and mode, a live preview in both modes and the contrast
 * report. Sends every value; the server keeps only what differs from the base theme.
 */
export function ThemeEditor({
  action,
  initial,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: ThemeEditorInitial;
}) {
  const t = useMessages().admin.themes;
  const locale = useLocale();
  const ratioFormat = useMemo(
    () => new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale],
  );
  const [state, formAction] = useActionState(action, IDLE);
  const [sets, setSets] = useState<Record<Mode, TokenSet>>(() => ({
    light: resolveTokens(initial.tokens, "light"),
    dark: resolveTokens(initial.tokens, "dark"),
  }));
  // Controlled: React resets uncontrolled fields after every action, which would wipe them on an error.
  const [name, setName] = useState(initial.name);
  const [scheduled, setScheduled] = useState(initial.startsAt !== null);
  const [startsLocal, setStartsLocal] = useState(initial.startsAt ? isoToZoneLocal(initial.startsAt) : "");
  const [endsLocal, setEndsLocal] = useState(initial.endsAt ? isoToZoneLocal(initial.endsAt) : "");

  const checks = useMemo(() => checkContrast(sanitizeTokens(sets)), [sets]);
  const failures = checks.filter((check) => !check.ok);

  function setToken(mode: Mode, key: TokenKey, value: string) {
    const hex = normalizeHex(value);
    if (hex) setSets((current) => ({ ...current, [mode]: { ...current[mode], [key]: hex } }));
  }

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="tokens" value={JSON.stringify(sets)} />

      <div className="grid max-w-md gap-1">
        <label htmlFor="theme-name" className="label">
          {t.editor.nameLabel}
        </label>
        <input
          id="theme-name"
          name="name"
          required
          minLength={3}
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="input"
        />
        <p className="text-xs text-ink-3">{t.editor.nameHelp}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {MODES.map((mode) => (
          <fieldset key={mode} className="card-soft grid gap-3 p-4">
            <legend className="label px-1">{t.editor.modes[mode]}</legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {TOKEN_KEYS.map((key) => {
                const value = sets[mode][key];
                const changed = value !== BASE_TOKENS[mode][key];
                const id = `token-${mode}-${key}`;
                return (
                  <li key={key} className="flex items-center gap-2">
                    <input
                      id={id}
                      type="color"
                      value={value.toLowerCase()}
                      onChange={(event) => setToken(mode, key, event.target.value)}
                      className="h-8 w-10 shrink-0 cursor-pointer border border-edge bg-surface p-0.5"
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 truncate text-sm">
                      {t.tokens[key]}
                    </label>
                    <input
                      key={value}
                      defaultValue={value}
                      aria-label={`${t.tokens[key]} (${t.editor.modes[mode]})`}
                      onBlur={(event) => {
                        if (normalizeHex(event.target.value)) setToken(mode, key, event.target.value);
                        else event.target.value = value;
                      }}
                      className="input num w-24 py-1 text-xs"
                      maxLength={7}
                    />
                    <button
                      type="button"
                      onClick={() => setToken(mode, key, BASE_TOKENS[mode][key])}
                      disabled={!changed}
                      className="btn btn-ghost btn-sm text-xs"
                    >
                      {t.editor.reset}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-sm justify-self-start"
        onClick={() => setSets({ light: { ...BASE_TOKENS.light }, dark: { ...BASE_TOKENS.dark } })}
      >
        {t.editor.resetAll}
      </button>

      <section aria-label={t.editor.preview} className="grid gap-3">
        <h2 className="label">{t.editor.preview}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {MODES.map((mode) => (
            <div key={mode} style={previewStyle(sets[mode])} className="bg-paper p-4 text-ink">
              <p className="label mb-2">{t.editor.modes[mode]}</p>
              <div className="card grid gap-2 p-3 shadow-hard">
                <p className="num text-xs text-ink-3">{t.editor.previewMeta}</p>
                <p className="text-lg font-bold [font-stretch:75%]">{t.editor.previewTitle}</p>
                <p className="text-sm text-ink-2">{t.editor.previewBody}</p>
                <div className="perforation" />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="btn btn-primary btn-sm">{t.editor.previewButton}</span>
                  <span className="text-sm font-semibold text-danger">{t.editor.previewDanger}</span>
                  <Stamp tone="success" size="sm">
                    {t.editor.previewSuccess}
                  </Stamp>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={t.editor.contrastTitle} className="card-soft grid gap-3 p-4">
        <div>
          <h2 className="label">{t.editor.contrastTitle}</h2>
          <p className="text-xs text-ink-3">{t.editor.contrastHelp}</p>
        </div>
        <p role="status" className={`text-sm font-semibold ${failures.length ? "text-danger" : "text-success"}`}>
          {failures.length ? plural(failures.length, t.editor.contrastFailures) : t.editor.contrastAllOk}
        </p>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
          {MODES.map((mode) => (
            <ul key={mode} className="grid gap-0.5 text-xs">
              <li className="label">{t.editor.modes[mode]}</li>
              {checks
                .filter((check) => check.mode === mode)
                .map((check) => (
                  <li
                    key={`${check.foreground}-${check.background}`}
                    className={`flex justify-between gap-3 ${check.ok ? "text-ink-2" : "font-semibold text-danger"}`}
                  >
                    <span>
                      {fmt(t.editor.contrastRow, {
                        foreground: t.tokens[check.foreground],
                        background: t.tokens[check.background],
                      })}
                    </span>
                    <span className="num">
                      {ratioFormat.format(check.ratio)}:1 / {ratioFormat.format(check.minimum)}
                    </span>
                  </li>
                ))}
            </ul>
          ))}
        </div>
      </section>

      <fieldset className="card-soft grid gap-3 p-4">
        <legend className="label px-1">{t.editor.scheduleLabel}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="scheduled"
            checked={scheduled}
            onChange={(event) => setScheduled(event.target.checked)}
          />
          {t.editor.scheduleHelp}
        </label>
        {scheduled ? (
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1 text-sm">
              <span className="label">{t.editor.startsAt}</span>
              <input
                type="datetime-local"
                name="startsAt"
                required
                value={startsLocal}
                onChange={(event) => setStartsLocal(event.target.value)}
                className="input num"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="label">{t.editor.endsAt}</span>
              <input
                type="datetime-local"
                name="endsAt"
                required
                value={endsLocal}
                onChange={(event) => setEndsLocal(event.target.value)}
                className="input num"
              />
            </label>
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel={t.editor.saving}>{t.editor.save}</SubmitButton>
        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`text-sm font-semibold ${state.status === "error" ? "text-danger" : "text-success"}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
