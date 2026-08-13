import { describe, expect, it, vi } from "vitest";
import { MediaAutoplayGuard } from "../lib/media-autoplay";

function createMedia(): {
  media: HTMLMediaElement;
  pause: ReturnType<typeof vi.fn>;
} {
  const pause = vi.fn();
  return {
    media: { autoplay: true, pause } as unknown as HTMLMediaElement,
    pause,
  };
}

describe("media autoplay guard", () => {
  it("stops each media element only once so manual playback can continue", () => {
    const guard = new MediaAutoplayGuard();
    const { media, pause } = createMedia();

    guard.prevent(media);
    media.autoplay = true;
    guard.prevent(media);

    expect(media.autoplay).toBe(false);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("stops newly discovered media independently", () => {
    const guard = new MediaAutoplayGuard();
    const first = createMedia();
    const second = createMedia();

    guard.prevent(first.media);
    guard.prevent(second.media);

    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(second.pause).toHaveBeenCalledTimes(1);
  });
});
