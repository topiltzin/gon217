import Image from "next/image";
import type { Site } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

export function HostWelcome({ host, locale }: { host: Site["host"]; locale: Locale }) {
  return (
    <div className="relative flex flex-col gap-5 self-start overflow-hidden rounded-(--radius-card) border border-primary/50 bg-linear-to-br from-primary/35 via-card to-card p-6 sm:p-8">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-sun via-accent to-primary" />
      <div className="flex items-center gap-4">
        {host.avatar ? (
          <Image
            src={host.avatar}
            alt={host.avatarAlt ?? ""}
            width={80}
            height={80}
            className="size-20 rounded-lg border-2 border-sun object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-20 place-items-center rounded-lg border-2 border-sun bg-sun font-display text-4xl text-on-sun"
          >
            {host.name.charAt(0)}
          </span>
        )}
        <div>
          <p className="eyebrow text-sun">{getDictionary(locale).yourHost}</p>
          <p className="font-display text-3xl uppercase">{host.name}</p>
        </div>
      </div>
      <p className="text-lg leading-relaxed text-card-foreground">{host.welcome}</p>
    </div>
  );
}
