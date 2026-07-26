import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "~/components/ui/button";

export function AddImageButton({ memoryId }: { memoryId: Id<"memories"> }) {
  const uploadFile = useUploadFile(api.files);
  const addImage = useMutation(api.items.addImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const key = await uploadFile(file);
            await addImage({ memoryId, key });
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : "Photo"}
      </Button>
    </>
  );
}

export function AddVoiceButton({ memoryId }: { memoryId: Id<"memories"> }) {
  const uploadFile = useUploadFile(api.files);
  const addVoice = useMutation(api.items.addVoice);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const upload = async (file: File, durationMs?: number) => {
    setBusy(true);
    try {
      const key = await uploadFile(file);
      await addVoice({ memoryId, key, durationMs, mimeType: file.type || undefined });
    } finally {
      setBusy(false);
    }
  };

  // Prefer a container Safari can also decode; MediaRecorder's browser
  // default is audio/webm on Chrome/Firefox, which Safari can't play.
  const PREFERRED_MIME_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  const pickMimeType = () =>
    PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

  const extensionFor = (mimeType: string) => {
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("ogg")) return "ogg";
    return "audio";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType });
        await upload(
          new File([blob], `voice-note.${extensionFor(recorder.mimeType)}`, {
            type: blob.type,
          }),
          Date.now() - startedAtRef.current,
        );
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      // No mic access or unsupported browser — fall back to a file picker.
      setUseFallback(true);
    }
  };

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices;

  if (!supported || useFallback) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await upload(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Audio file"}
        </Button>
      </>
    );
  }

  return (
    <Button
      variant={recording ? "destructive" : "outline"}
      size="sm"
      disabled={busy}
      onClick={() =>
        recording ? recorderRef.current?.stop() : startRecording()
      }
    >
      {busy ? "Uploading…" : recording ? "Stop recording" : "Voice note"}
    </Button>
  );
}
