export class MediaAutoplayGuard {
  private readonly stoppedMedia = new WeakSet<HTMLMediaElement>();

  prevent(media: HTMLMediaElement): void {
    media.autoplay = false;
    if (this.stoppedMedia.has(media)) return;

    this.stoppedMedia.add(media);
    media.pause();
  }
}
