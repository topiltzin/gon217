// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { I18nProvider } from "@/components/I18nProvider";
import { VideoList } from "@/components/VideoList";

// jsdom has no modal dialog support; emulate open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

const videos = [{ title: "How to draw a dragon", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }];

describe("VideoList", () => {
  it("shows a friendly message when there are no videos", () => {
    render(<VideoList videos={[]} hostName="Gonzalo" />);
    expect(screen.getByText(/no videos yet/i)).toBeTruthy();
  });

  it("asks for a grown-up before leaving for YouTube", () => {
    render(<VideoList videos={videos} hostName="Gonzalo" />);
    // No link to YouTube until the child chooses a video.
    expect(screen.queryByRole("link")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /how to draw a dragon/i }));
    const dialog = document.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText(/ask a grown-up/i)).toBeTruthy();

    const go = screen.getByRole("link", { name: /go to youtube/i });
    expect(go.getAttribute("href")).toBe(videos[0].url);
    expect(go.getAttribute("target")).toBe("_blank");
    expect(go.getAttribute("rel")).toBe("noopener noreferrer");

    fireEvent.click(screen.getByRole("button", { name: /stay here/i }));
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("speaks Spanish", () => {
    render(
      <I18nProvider locale="es">
        <VideoList videos={videos} hostName="Gonzalo" />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /how to draw a dragon/i }));
    expect(screen.getByRole("link", { name: /ir a youtube/i })).toBeTruthy();
    expect(screen.getByText(/pregúntale a un adulto/i)).toBeTruthy();
  });
});
