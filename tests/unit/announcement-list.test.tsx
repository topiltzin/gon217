// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnnouncementList } from "@/components/AnnouncementList";

afterEach(cleanup);

describe("AnnouncementList", () => {
  it("shows a friendly message when there is no news", () => {
    render(<AnnouncementList announcements={[]} games={[]} hostName="Gonzalo" locale="en" />);
    expect(screen.getByText(/no news yet/i)).toBeTruthy();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("renders each announcement with a date and optional game link", () => {
    render(
      <AnnouncementList
        hostName="Gonzalo"
        locale="en"
        games={[{ slug: "catch-it", title: "Catch It!" }]}
        announcements={[
          { id: "b", title: "New game", date: "2026-10-02", body: "Try it!", gameSlug: "catch-it" },
          { id: "a", title: "Hello", date: "2026-10-01", body: "Welcome!" },
        ]}
      />,
    );
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);
    expect(articles[0].querySelector("time")?.getAttribute("datetime")).toBe("2026-10-02");
    expect(screen.getByRole("link", { name: /play catch it!/i }).getAttribute("href")).toBe("/en/games/catch-it");
  });

  it("speaks Spanish", () => {
    render(
      <AnnouncementList
        hostName="Gonzalo"
        locale="es"
        games={[{ slug: "catch-it", title: "¡Atrápala!" }]}
        announcements={[{ id: "a", title: "Hola", date: "2026-10-01", body: "¡Bienvenidos!", gameSlug: "catch-it" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Noticias" })).toBeTruthy();
    expect(screen.getByText(/octubre/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /jugar ¡atrápala!/i }).getAttribute("href")).toBe("/es/games/catch-it");
  });

});
