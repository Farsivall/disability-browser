"use client";

import { useEffect, useRef, useState } from "react";
import {
  A2UIProvider,
  A2UIRenderer,
  useA2UI,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { catalog } from "@/a2ui/catalog";
import { PerceptualSurface } from "@/a2ui/PerceptualSurface";
import { ProxyProvider } from "@/a2ui/proxy-context";
import { surfaceBus } from "@/a2ui/surface-bus";
import {
  sendProxyMessage,
  PERCEPTUAL_AGENT_CHANNEL,
} from "@/lib/proxy-transport";

export function SidePanelSurface() {
  return (
    <ProxyProvider onProxy={sendProxyMessage}>
      <A2UIProvider catalog={catalog}>
        <SidePanelSurfaceInner />
      </A2UIProvider>
    </ProxyProvider>
  );
}

function SidePanelSurfaceInner() {
  const actions = useA2UIActions();
  const { clearSurfaces } = useA2UI();
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const seenRef = useRef(0);
  const createdSurfacesRef = useRef<Set<string>>(new Set());
  const channel = PERCEPTUAL_AGENT_CHANNEL;

  function applyOps(ops: Array<Record<string, unknown>>, fullReplay = false) {
    if (!ops.length) return;

    if (fullReplay) {
      clearSurfaces();
      createdSurfacesRef.current.clear();
    }

    const out = ops.filter((op) => {
      const cs = op.createSurface as { surfaceId?: string } | undefined;
      if (cs?.surfaceId) {
        if (createdSurfacesRef.current.has(cs.surfaceId)) return false;
        createdSurfacesRef.current.add(cs.surfaceId);
      }
      return true;
    });

    try {
      actions.processMessages(out);
      setIsUpdating(true);
      window.setTimeout(() => setIsUpdating(false), 120);
    } catch (err) {
      console.warn("[side-panel] processMessages threw:", err);
    }
  }

  useEffect(() => {
    const initial = surfaceBus.snapshot(channel);
    if (initial.ops.length) {
      applyOps(initial.ops as never, true);
      seenRef.current = initial.ops.length;
      setSurfaceId(initial.surfaceId);
    }
    return surfaceBus.subscribe(channel, (snap) => {
      /* pushDemoSurface reset()+push() shrinks the buffer — rewind seenRef */
      if (snap.ops.length < seenRef.current) {
        seenRef.current = 0;
        createdSurfacesRef.current.clear();
        if (snap.ops.length === 0) {
          clearSurfaces();
          setSurfaceId(null);
          return;
        }
      }

      const tail = snap.ops.slice(seenRef.current);
      const fullReplace =
        seenRef.current === 0 &&
        tail.length > 0 &&
        tail.some((op) => "createSurface" in op);

      if (tail.length) {
        applyOps(tail as never, fullReplace);
      }
      seenRef.current = snap.ops.length;
      if (snap.surfaceId) setSurfaceId(snap.surfaceId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, channel]);

  return (
    <div className="pw-side-panel-surface" role="main" aria-label="Accessible page view">
      <div
        className="pw-side-panel-surface-inner"
        data-updating={isUpdating ? "true" : undefined}
        aria-busy={isUpdating}
      >
        {!surfaceId ? (
          <div className="pw-side-panel-empty">
            <h2>Your page, rebuilt for you</h2>
            <p>
              Describe what&apos;s hard about the current page — each new command
              refines the layout while keeping your needs in session.
            </p>
          </div>
        ) : (
          <PerceptualSurface surfaceId={surfaceId}>
            <A2UIRenderer surfaceId={surfaceId} />
          </PerceptualSurface>
        )}
      </div>
    </div>
  );
}
