import Image from "next/image";
import type { Site } from "@/lib/content";
import { getDictionary, type Locale } from "@/lib/i18n";

export function HostWelcome({ host, locale }: { host: Site["host"]; locale: Locale }) {
  return (
    <div className="flex flex-col gap-5 rounded-(--radius-card) bg-primary p-6 text-on-primary sm:p-8">
      <div className="flex items-center gap-4">
        {host.avatar ? (
          <Image
            src={host.avatar}
            alt={host.avatarAlt ?? ""}
            width={80}
            height={80}
            className="size-20 rounded-full border-4 border-sun object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-20 place-items-center rounded-full border-4 border-sun bg-sun font-display text-4xl font-bold text-on-sun"
          >
            {host.name.charAt(0)}
          </span>
        )}
        <div>
          <p className="font-bold">{getDictionary(locale).yourHost}</p>
          <p className="font-display text-3xl font-bold">{host.name}</p>
        </div>
      </div>
      <p className="text-xl leading-relaxed">{host.welcome}</p>
    </div>
  );
}
