/**
 * useBackgroundBridge — React hook that manages the long-lived port to the
 * background service worker, handles all incoming push messages, and exposes
 * imperative methods (requestExtraction, sendProxy).
 *
 * This centralises all chrome.runtime communication so App.tsx stays clean.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface ExtractedPage {
  url: string;
  pageType: string | null;
  title: string;
  elements: Array<Record<string, unknown>>;
}

interface ProxyAck {
  action: string;
  sourceRef: string;
  status: "OK" | "NOT_FOUND" | "ERROR";
  detail?: string;
}

interface BridgeState {
  pageTitle: string | null;
  extractedPage: ExtractedPage | null;
  lastAck: ProxyAck | null;
  requestExtraction: () => void;
  sendProxy: (sourceRef: string, action: string, value?: string) => void;
}

export function useBackgroundBridge(): BridgeState {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const [pageTitle, setPageTitle]       = useState<string | null>(null);
  const [extractedPage, setExtractedPage] = useState<ExtractedPage | null>(null);
  const [lastAck, setLastAck]           = useState<ProxyAck | null>(null);

  // Connect and reconnect if the port drops.
  useEffect(() => {
    function connect() {
      const port = chrome.runtime.connect({ name: "side-panel" });
      portRef.current = port;

      port.onMessage.addListener((msg: Record<string, unknown>) => {
        if (msg.type === "PAGE_TITLE") {
          setPageTitle(msg.title as string);
        }
        if (msg.type === "EXTRACTED_PAGE") {
          setExtractedPage(msg.data as ExtractedPage);
        }
        if (msg.type === "PROXY_ACK") {
          setLastAck(msg as unknown as ProxyAck);
        }
      });

      port.onDisconnect.addListener(() => {
        portRef.current = null;
        // Reconnect after a short back-off.
        setTimeout(connect, 300);
      });
    }

    connect();

    return () => {
      portRef.current?.disconnect();
    };
  }, []);

  const send = useCallback((msg: Record<string, unknown>) => {
    portRef.current?.postMessage(msg);
  }, []);

  const requestExtraction = useCallback(() => {
    send({ type: "REQUEST_EXTRACTION" });
  }, [send]);

  const sendProxy = useCallback(
    (sourceRef: string, action: string, value?: string) => {
      send({ type: "PROXY_EVENT", action, sourceRef, ...(value !== undefined ? { value } : {}) });
    },
    [send],
  );

  // Auto-extract when the panel first connects (page title arriving signals content script is live).
  useEffect(() => {
    if (pageTitle && !extractedPage) {
      requestExtraction();
    }
  }, [pageTitle, extractedPage, requestExtraction]);

  return { pageTitle, extractedPage, lastAck, requestExtraction, sendProxy };
}
