"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import type { ProxyMessage } from "@/lib/contracts";

type ProxyEmit = (message: ProxyMessage) => void;

const ProxyContext = createContext<ProxyEmit | null>(null);

/** Default handler logs ProxyMessages — side panel overrides via Provider. */
function defaultEmit(message: ProxyMessage) {
  console.log("[PerceptualWeb] ProxyMessage", message);
}

export function ProxyProvider({
  children,
  onProxy,
}: {
  children: ReactNode;
  onProxy?: ProxyEmit;
}) {
  const emit = useCallback(
    (message: ProxyMessage) => {
      (onProxy ?? defaultEmit)(message);
    },
    [onProxy],
  );

  return (
    <ProxyContext.Provider value={emit}>{children}</ProxyContext.Provider>
  );
}

export function useProxyEmit(): ProxyEmit {
  const emit = useContext(ProxyContext);
  return emit ?? defaultEmit;
}

export function buildProxyMessage(
  action: ProxyMessage["action"],
  sourceRef: string,
  value?: string,
): ProxyMessage {
  return {
    type: "PROXY_EVENT",
    action,
    sourceRef,
    ...(value !== undefined ? { value } : {}),
  };
}
