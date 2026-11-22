// Nakładka do nagrania: pasek napisów, widoczny kursor i podświetlenie klikanego elementu.
// Wstrzykiwana przez addInitScript — kod aplikacji pozostaje bez zmian.

export const overlayScript = () => {
  const install = () => {
    if (document.getElementById("demo-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "demo-overlay-style";
    style.textContent = `
      #demo-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;
        max-width:min(1100px,90vw);padding:14px 26px;border-radius:14px;background:rgba(15,23,42,.88);color:#fff;
        font:600 24px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);
        pointer-events:none;transition:opacity .25s;opacity:0}
      #demo-caption small{display:block;margin-top:4px;font-weight:400;font-size:17px;opacity:.85}
      #demo-chip{position:fixed;top:18px;right:22px;z-index:2147483647;padding:6px 14px;border-radius:999px;
        background:#f59e0b;color:#111;font:700 15px system-ui,sans-serif;pointer-events:none;display:none}
      #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(239,68,68,.35);border:2px solid rgba(239,68,68,.95);z-index:2147483647;pointer-events:none;
        transition:transform .12s}
      #demo-cursor.down{transform:scale(.6)}
      #demo-highlight{position:fixed;z-index:2147483646;border:3px solid #ef4444;border-radius:10px;
        box-shadow:0 0 0 6px rgba(239,68,68,.18);pointer-events:none;transition:all .2s;display:none}`;
    document.documentElement.appendChild(style);
    for (const id of ["demo-caption", "demo-chip", "demo-cursor", "demo-highlight"]) {
      const el = document.createElement("div");
      el.id = id;
      document.documentElement.appendChild(el);
    }
    const cursor = document.getElementById("demo-cursor");
    const last = window.__demoCursor ?? { x: -100, y: -100 };
    cursor.style.left = `${last.x}px`;
    cursor.style.top = `${last.y}px`;
    document.addEventListener("mousemove", (e) => {
      window.__demoCursor = { x: e.clientX, y: e.clientY };
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    }, true);
    document.addEventListener("mousedown", () => cursor.classList.add("down"), true);
    document.addEventListener("mouseup", () => cursor.classList.remove("down"), true);
    // Napis i znacznik przeżywają nawigację (sessionStorage).
    const saved = sessionStorage.getItem("demo-caption");
    if (saved) window.__demoSetCaption(saved, false);
  };

  window.__demoSetCaption = (html, persist = true) => {
    const el = document.getElementById("demo-caption");
    if (!el) return;
    el.innerHTML = html;
    el.style.opacity = html ? "1" : "0";
    if (persist) sessionStorage.setItem("demo-caption", html);
  };
  window.__demoChip = (text) => {
    const el = document.getElementById("demo-chip");
    if (!el) return;
    el.textContent = text;
    el.style.display = text ? "block" : "none";
  };
  window.__demoHighlight = (rect) => {
    const el = document.getElementById("demo-highlight");
    if (!el) return;
    if (!rect) return void (el.style.display = "none");
    Object.assign(el.style, { display: "block", left: `${rect.x - 6}px`, top: `${rect.y - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};
