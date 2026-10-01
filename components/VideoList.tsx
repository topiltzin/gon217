"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Button, buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Video } from "@/lib/content";

/**
 * Host-picked YouTube links. Nothing loads from YouTube on this page (no
 * embeds, no thumbnails); a grown-up check appears before leaving the site.
 */
export function VideoList({ videos, hostName }: { videos: Video[]; hostName: string }) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<Video | null>(null);

  function open(video: Video) {
    setChosen(video);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <section aria-labelledby="videos-heading" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h2 id="videos-heading" className="flex items-center gap-3 text-3xl uppercase sm:text-4xl">
        <Icon name="tv" className="size-9 text-accent" />
        {t.videos}
      </h2>
      {videos.length === 0 ? (
        <p className="mt-4 rounded-(--radius-card) bg-card p-6 text-lg text-card-foreground">{t.noVideos(hostName)}</p>
      ) : (
        <>
          <p className="mt-2 text-lg text-muted-foreground">{t.videosIntro(hostName)}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <li key={video.url}>
                <button
                  type="button"
                  onClick={() => open(video)}
                  className="flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-(--radius-card) bg-card p-5 text-left transition-transform duration-(--duration-base) hover:-translate-y-1"
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent text-on-accent">
                    <Icon name="play" className="size-8" />
                  </span>
                  <span>
                    <span className="block font-display text-xl font-semibold">{video.title}</span>
                    <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Icon name="external" className="size-4" />
                      {t.opensYouTube}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="leaving-heading"
        onClose={() => setChosen(null)}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-(--radius-card) bg-card p-8 text-center text-card-foreground backdrop:bg-black/70"
      >
        <Icon name="tv" className="mx-auto size-14 text-accent" />
        <h3 id="leaving-heading" className="mt-3 text-3xl font-bold">
          {t.leaving.title}
        </h3>
        {chosen && <p className="mt-2 font-display text-xl font-semibold text-sun">{chosen.title}</p>}
        <p className="mt-3 text-lg">{t.leaving.body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {chosen && (
            <a
              href={chosen.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className={buttonClass("accent")}
            >
              <Icon name="external" />
              {t.leaving.go}
            </a>
          )}
          <Button variant="ghost" onClick={close} autoFocus>
            {t.leaving.stay}
          </Button>
        </div>
      </dialog>
    </section>
  );
}
