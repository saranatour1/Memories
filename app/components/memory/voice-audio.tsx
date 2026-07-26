import { useEffect, useState } from "react";

/**
 * Renders a voice note's <audio> player, degrading to a download link if
 * the viewer's browser can't decode the stored mimeType (e.g. Safari can't
 * play audio/webm recorded in Chrome — see #10). The playability check
 * needs `document` and must run after mount: doing it during render would
 * make SSR and client output disagree on which element renders.
 */
export function VoiceAudio({
  url,
  mimeType,
  className,
}: {
  url: string;
  mimeType?: string;
  className?: string;
}) {
  const [playable, setPlayable] = useState(true);

  useEffect(() => {
    if (!mimeType) return;
    const probe = document.createElement("audio");
    setPlayable(probe.canPlayType(mimeType) !== "");
  }, [mimeType]);

  if (!playable) {
    return (
      <a href={url} download className="text-sm text-muted-foreground underline">
        Download voice note (can't play in this browser)
      </a>
    );
  }
  return <audio controls src={url} className={className} />;
}
