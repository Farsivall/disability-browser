/**
 * I3c bridge — runs in the packaged side-panel host page (extension origin).
 * MV3 forbids inline scripts, so this lives in an external file.
 *
 *   C's panel (iframe, localhost:3000)
 *     --window.postMessage-->  host  --chrome Port-->  background.js
 *     <--window.postMessage--  host  <--chrome Port--  background.js
 */
const PANEL_ORIGIN = "http://localhost:3000";
const frame = document.getElementById("pw-frame");
let port = null;

function toPanel(msg) {
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage(msg, PANEL_ORIGIN);
  }
}

function connect() {
  port = chrome.runtime.connect({ name: "side-panel" });
  // background -> host -> iframe (PAGE_TITLE, EXTRACTED_PAGE, PROXY_ACK, ERROR)
  port.onMessage.addListener((msg) => toPanel(msg));
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 300);
  });
}
connect();

// iframe -> host -> background (REQUEST_EXTRACTION, PROXY_EVENT)
window.addEventListener("message", (event) => {
  if (event.origin !== PANEL_ORIGIN) return;
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "REQUEST_EXTRACTION" || msg.type === "PROXY_EVENT") {
    if (port) port.postMessage(msg);
  }
});
