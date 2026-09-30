"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ScoreUnit } from "@/lib/i18n";
import {
  ADJECTIVES,
  ANIMALS,
  MAX_NICK_NUMBER,
  credentialsSchema,
  formatNickname,
  type Adjective,
  type Animal,
} from "@/lib/player";
import { usePlayer, type PlayerError } from "./PlayerProvider";

type GameInfo = { slug: string; title: string; unit: ScoreUnit };

const selectClass =
  "min-h-12 w-full rounded-2xl border-2 border-border bg-muted px-3 text-lg text-foreground";

export function PlayerPanel({ games }: { games: GameInfo[] }) {
  const { state, logOut } = usePlayer();
  const t = useT();
  const locale = useLocale();

  return (
    <section
      aria-labelledby="player-heading"
      className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-10 sm:px-6"
    >
      <h1 id="player-heading" className="text-4xl font-bold sm:text-5xl">
        {t.player.title}
      </h1>

      {state.status === "loading" && <p className="text-xl">{t.shell.loading}</p>}
      {state.status === "unavailable" && <p className="text-xl">{t.player.errors.unavailable}</p>}

      {state.status === "ready" && state.player && (
        <div className="flex flex-col gap-5 rounded-(--radius-card) bg-card p-6 text-card-foreground">
          <p className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Icon name="user" className="size-7 text-sun" />
            {t.player.loggedInAs(formatNickname(state.player, locale))}
          </p>
          <h2 className="text-2xl font-bold">{t.player.myBests}</h2>
          {Object.keys(state.bests).length === 0 ? (
            <p>{t.player.noBests}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {games
                .filter((g) => state.bests[g.slug] !== undefined)
                .map((g) => (
                  <li
                    key={g.slug}
                    className="flex justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-foreground"
                  >
                    <span>{g.title}</span>
                    <span className="font-bold">
                      {state.bests[g.slug]} {t.units[g.unit]}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <Button variant="ghost" onClick={logOut} className="self-start">
            <Icon name="log-out" />
            {t.player.logOut}
          </Button>
        </div>
      )}

      {state.status === "ready" && !state.player && <LoginForm />}
    </section>
  );
}

function LoginForm() {
  const { signUp, logIn } = usePlayer();
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [adjective, setAdjective] = useState<Adjective | "">("");
  const [animal, setAnimal] = useState<Animal | "">("");
  const [number, setNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<PlayerError | null>(null);
  const [busy, setBusy] = useState(false);

  const byLabel = <K extends string>(words: Record<K, Record<"en" | "es", string>>) =>
    (Object.keys(words) as K[]).sort((a, b) =>
      words[a][locale].localeCompare(words[b][locale], locale),
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ adjective, animal, number: Number(number), pin });
    if (!parsed.success) return setError("invalid");
    setBusy(true);
    setError(await (mode === "new" ? signUp : logIn)(parsed.data));
    setBusy(false);
  }

  const tabClass = (active: boolean) =>
    `min-h-12 flex-1 rounded-2xl px-4 font-display text-lg font-semibold ${
      active ? "bg-primary text-on-primary" : "bg-muted text-foreground hover:bg-[#32324a]"
    }`;

  return (
    <div className="flex flex-col gap-5 rounded-(--radius-card) bg-card p-6 text-card-foreground">
      <p className="text-lg">{t.player.optional}</p>
      <div className="flex gap-2">
        {(["new", "existing"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={tabClass(mode === m)}
          >
            {m === "new" ? t.player.newPlayer : t.player.havePlayer}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-xl font-semibold">{t.player.pickName}</legend>
          <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
            <label className="flex flex-col gap-1">
              <span>{t.player.word}</span>
              <select
                value={adjective}
                onChange={(e) => setAdjective(e.target.value as Adjective)}
                className={selectClass}
              >
                <option value="">–</option>
                {byLabel(ADJECTIVES).map((key) => (
                  <option key={key} value={key}>
                    {ADJECTIVES[key][locale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{t.player.animal}</span>
              <select
                value={animal}
                onChange={(e) => setAnimal(e.target.value as Animal)}
                className={selectClass}
              >
                <option value="">–</option>
                {byLabel(ANIMALS).map((key) => (
                  <option key={key} value={key}>
                    {ANIMALS[key][locale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{t.player.number}</span>
              <select
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className={selectClass}
              >
                <option value="">–</option>
                {Array.from({ length: MAX_NICK_NUMBER }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {adjective && animal && number && (
            <p className="font-display text-2xl font-semibold text-sun">
              {formatNickname({ adjective, animal, number: Number(number) }, locale)}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="font-display text-xl font-semibold">{t.player.pin}</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete={mode === "new" ? "new-password" : "current-password"}
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              aria-describedby={`${id}-pin-hint`}
              className={`${selectClass} max-w-40 tracking-[0.5em]`}
            />
          </label>
          <span id={`${id}-pin-hint`} className="text-muted-foreground">
            {mode === "new" ? t.player.pinHint : t.player.rememberBoth}
          </span>
        </div>

        {mode === "new" && <p>{t.player.rememberBoth}</p>}

        <p role="alert" className="flex min-h-7 items-center gap-2 font-bold text-sun">
          {error && (
            <>
              <Icon name="x" className="size-5 shrink-0" />
              {t.player.errors[error]}
            </>
          )}
        </p>

        <Button type="submit" variant="accent" disabled={busy} className="self-start">
          <Icon name="user" />
          {busy ? t.player.working : mode === "new" ? t.player.create : t.player.enter}
        </Button>
      </form>
    </div>
  );
}
