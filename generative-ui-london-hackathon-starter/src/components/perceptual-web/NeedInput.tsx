"use client";

import { useCallback, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSubmitNeed } from "./use-submit-need";

export type InputMode = "text" | "voice";

/**
 * Voice + text need input. Both modes write to the same field and share submit flow.
 */
export function NeedInput() {
  const [mode, setMode] = useState<InputMode>("text");
  const [value, setValue] = useState("");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const baseTextRef = useRef("");
  const { submitNeed, isSubmitting, isAgentReady, refinementCount } =
    useSubmitNeed();

  const appendTranscript = useCallback((chunk: string) => {
    setValue((prev) => {
      const base = baseTextRef.current || prev;
      const merged = base ? `${base} ${chunk}`.trim() : chunk;
      return merged;
    });
    baseTextRef.current = "";
    setVoiceHint("Transcript added — edit or press Regenerate view");
  }, []);

  const {
    state: speechState,
    interim,
    isListening,
    isSupported,
    toggle: toggleMic,
    stop: stopMic,
  } = useSpeechRecognition({
    onFinalTranscript: appendTranscript,
    onInterimTranscript: (text) => {
      setVoiceHint(`Hearing: "${text}"`);
    },
  });

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (isListening) stopMic();
      const trimmed = value.trim();
      if (!trimmed || isSubmitting) return;
      await submitNeed(trimmed);
      setValue("");
      setVoiceHint(null);
    },
    [value, isSubmitting, isListening, stopMic, submitNeed],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleMicClick = useCallback(() => {
    if (!isSupported) {
      setVoiceHint("Voice not supported in this browser — use text input");
      return;
    }
    if (speechState === "denied") {
      setVoiceHint("Microphone permission denied — allow mic or use text");
      return;
    }
    if (!isListening) {
      baseTextRef.current = value.trim();
      setVoiceHint("Listening… tap mic again to stop");
    }
    toggleMic();
  }, [isSupported, speechState, isListening, toggleMic, value]);

  const displayValue =
    isListening && interim
      ? [baseTextRef.current || value, interim].filter(Boolean).join(" ")
      : value;

  return (
    <form
      className="pw-side-panel-input"
      onSubmit={handleSubmit}
      aria-label="Describe your accessibility need"
    >
      <div className="pw-input-mode-row">
        <span className="pw-input-mode-label" id="pw-input-mode-label">
          Input mode
        </span>
        <div
          className="pw-input-mode-toggle"
          role="group"
          aria-labelledby="pw-input-mode-label"
        >
          <button
            type="button"
            className={`pw-input-mode-btn${mode === "text" ? " pw-input-mode-btn--active" : ""}`}
            aria-pressed={mode === "text"}
            onClick={() => {
              if (isListening) stopMic();
              setMode("text");
              setVoiceHint(null);
            }}
          >
            Text
          </button>
          <button
            type="button"
            className={`pw-input-mode-btn${mode === "voice" ? " pw-input-mode-btn--active" : ""}`}
            aria-pressed={mode === "voice"}
            onClick={() => setMode("voice")}
          >
            Voice
          </button>
        </div>
        {!isAgentReady && (
          <span className="pw-input-agent-hint">Agent offline</span>
        )}
      </div>

      <label htmlFor="pw-need-input">
        What&apos;s hard about this page?
      </label>

      <textarea
        id="pw-need-input"
        className="pw-side-panel-textarea pw-focusable"
        value={displayValue}
        onChange={(e) => {
          if (isListening) stopMic();
          setValue(e.target.value);
          setVoiceHint(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          mode === "voice"
            ? 'Tap the mic and say e.g. "Too much going on, text is too small"'
            : 'e.g. "Too much going on, text is too small"'
        }
        rows={3}
        disabled={isSubmitting}
        aria-describedby="pw-voice-hint"
      />

      {mode === "voice" && (
        <div className="pw-voice-row">
          <button
            type="button"
            className={`pw-mic-btn pw-focusable${isListening ? " pw-mic-btn--active" : ""}`}
            onClick={handleMicClick}
            aria-pressed={isListening}
            aria-label={isListening ? "Stop listening" : "Start voice input"}
            disabled={isSubmitting}
          >
            <MicIcon listening={isListening} />
            <span>{isListening ? "Stop" : "Tap to speak"}</span>
          </button>
        </div>
      )}

      <p
        id="pw-voice-hint"
        className="pw-voice-hint"
        role="status"
        aria-live="polite"
      >
        {voiceHint ??
          (mode === "voice"
            ? "Your words appear above — edit if needed, then Regenerate view"
            : "Press Enter to submit")}
      </p>

      <div className="pw-side-panel-actions">
        <button
          type="submit"
          className="pw-side-panel-btn pw-side-panel-btn--primary pw-focusable"
          disabled={isSubmitting || !displayValue.trim()}
        >
          {isSubmitting
            ? "Generating…"
            : refinementCount > 0
              ? "Refine view"
              : "Regenerate view"}
        </button>
      </div>
    </form>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      {listening && (
        <circle cx="12" cy="12" r="10" strokeDasharray="4 4" opacity="0.5" />
      )}
    </svg>
  );
}
