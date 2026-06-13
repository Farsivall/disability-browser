// Side panel script - plain JS, no build step for Phases 1-3.

var statusBar   = document.getElementById("status-bar");
var statusText  = document.getElementById("status-text");
var titleEl     = document.getElementById("page-title-value");
var extractOut  = document.getElementById("extract-output");
var proxyLog    = document.getElementById("proxy-log");
var btnExtract  = document.getElementById("btn-extract");
var btnClear    = document.getElementById("btn-clear-extract");
var btnProxy    = document.getElementById("btn-proxy");
var proxyRef    = document.getElementById("proxy-ref");
var proxyAction = document.getElementById("proxy-action");
var proxyValue  = document.getElementById("proxy-value");

var port = null;
var lastExtracted = null;
var PLACEHOLDER = "Press Extract Page to see ExtractedPage JSON";

function connect() {
  port = chrome.runtime.connect({ name: "side-panel" });
  port.onMessage.addListener(handleMessage);
  port.onDisconnect.addListener(function() {
    setStatus("disconnected", "Disconnected - reconnecting...");
    setTimeout(connect, 500);
  });
  setStatus("connected", "Connected to background");
}

connect();

function send(msg) {
  if (port) port.postMessage(msg);
}

function handleMessage(msg) {
  if (msg.type === "PAGE_TITLE") {
    titleEl.textContent = msg.title || "(no title)";
    titleEl.classList.remove("empty");
    setStatus("connected", "Page: " + msg.title);
  }

  if (msg.type === "EXTRACTED_PAGE") {
    lastExtracted = msg.data;
    extractOut.classList.remove("empty");
    extractOut.textContent = JSON.stringify(msg.data, null, 2);
    var count = msg.data && msg.data.elements ? msg.data.elements.length : 0;
    setStatus("connected", "Extracted " + count + " elements");
  }

  if (msg.type === "PROXY_ACK") {
    var action = msg.action || "?";
    var ref    = msg.sourceRef || "?";
    var status = msg.status || "?";
    appendProxyLog("ACK [" + action + "] sourceRef=" + ref + " -> " + status);
  }

  if (msg.type === "ERROR") {
    setStatus("error", msg.detail || "Unknown error");
    appendProxyLog("ERROR: " + msg.detail);
  }
}

btnExtract.addEventListener("click", function() {
  extractOut.textContent = "Extracting...";
  extractOut.classList.remove("empty");
  send({ type: "REQUEST_EXTRACTION" });
});

btnClear.addEventListener("click", function() {
  extractOut.textContent = PLACEHOLDER;
  extractOut.classList.add("empty");
  lastExtracted = null;
});

btnProxy.addEventListener("click", function() {
  var ref    = proxyRef.value.trim();
  var action = proxyAction.value;
  var val    = proxyValue.value || undefined;

  if (!ref) {
    appendProxyLog("Enter a sourceRef first");
    return;
  }

  send({ type: "PROXY_EVENT", action: action, sourceRef: ref, value: val });
  appendProxyLog("-> sent " + action + " to " + ref + (val ? " value=" + val : ""));
});

function setStatus(cls, text) {
  statusBar.className = cls;
  statusText.textContent = text;
}

function appendProxyLog(line) {
  proxyLog.classList.remove("empty");
  var ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  proxyLog.textContent += "[" + ts + "] " + line + "\n";
  proxyLog.scrollTop = proxyLog.scrollHeight;
}

window._pw = {
  sendProxy: function(ref, action, val) {
    send({ type: "PROXY_EVENT", action: action || "click", sourceRef: ref, value: val });
  },
  getExtracted: function() { return lastExtracted; },
  requestExtraction: function() { send({ type: "REQUEST_EXTRACTION" }); }
};
