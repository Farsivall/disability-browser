/**
 * Agent status lines for the side panel ("Researching best practices...", etc.)
 */
export type StatusLine = {
  id: string;
  text: string;
  tone?: "info" | "success" | "warn";
  at: number;
};

type Listener = (lines: StatusLine[]) => void;

let lines: StatusLine[] = [];
const listeners = new Set<Listener>();

export const statusBus = {
  push(text: string, tone: StatusLine["tone"] = "info") {
    const line: StatusLine = {
      id: crypto.randomUUID(),
      text,
      tone,
      at: Date.now(),
    };
    lines = [...lines, line].slice(-8);
    listeners.forEach((fn) => fn(lines));
    return line.id;
  },

  clear() {
    lines = [];
    listeners.forEach((fn) => fn(lines));
  },

  snapshot(): StatusLine[] {
    return lines;
  },

  subscribe(fn: Listener) {
    listeners.add(fn);
    fn(lines);
    return () => listeners.delete(fn);
  },
};
