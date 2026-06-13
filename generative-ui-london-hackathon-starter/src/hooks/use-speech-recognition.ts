"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: { isFinal: boolean; [i: number]: { transcript: string } };
    };
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechRecognitionState =
  | "idle"
  | "listening"
  | "unsupported"
  | "denied"
  | "error";

export function useSpeechRecognition({
  onFinalTranscript,
  onInterimTranscript,
  lang = "en-GB",
}: {
  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  lang?: string;
}) {
  const [state, setState] = useState<SpeechRecognitionState>("idle");
  const [interim, setInterim] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const ok = getSpeechRecognitionCtor() !== null;
    setIsSupported(ok);
    if (!ok) setState("unsupported");
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState((s) =>
      s === "denied" || s === "error" || s === "unsupported" ? s : "idle",
    );
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    stop();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      setInterim("");
    };

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }

      if (interimText) {
        setInterim(interimText);
        onInterimTranscript?.(interimText);
      }

      if (finalText.trim()) {
        onFinalTranscript?.(finalText.trim());
        setInterim("");
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") setState("denied");
      else setState("error");
      recognitionRef.current = null;
      setInterim("");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setState((s) => (s === "denied" || s === "error" ? s : "idle"));
      setInterim("");
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setState("error");
    }
  }, [lang, onFinalTranscript, onInterimTranscript, stop]);

  const toggle = useCallback(() => {
    if (state === "listening") stop();
    else start();
  }, [state, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    state,
    interim,
    isListening: state === "listening",
    isSupported,
    start,
    stop,
    toggle,
  };
}
