import { useEffect, useState } from "react";

// TEMPORARY: shown with ?viewport, to read real phone measurements before choosing when to allow for Safari's
// toolbar. Remove before merging.

function probe(css: string): number {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;${css}`;
  document.body.appendChild(el);
  const h = el.offsetHeight;
  el.remove();
  return h;
}

function safeArea(): string {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(el);
  const s = getComputedStyle(el);
  const out = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseFloat(v)).join(" ");
  el.remove();
  return out;
}

function read(allowance: number) {
  const vv = window.visualViewport;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return [
    ["screen", `${screen.width} x ${screen.height}`],
    ["inner", `${innerWidth} x ${innerHeight}`],
    ["screen - inner", String(screen.height - innerHeight)],
    ["visual", vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)} @${Math.round(vv.offsetTop)}` : "none"],
    ["svh / dvh / lvh", `${probe("height:100svh")} / ${probe("height:100dvh")} / ${probe("height:100lvh")}`],
    ["clientHeight", String(document.documentElement.clientHeight)],
    ["safe t r b l", safeArea()],
    ["standalone", String(standalone)],
    ["allowance", String(allowance)],
    ["dpr", String(devicePixelRatio)],
  ];
}

export function ViewportReadout({ allowance }: { allowance: number }) {
  const [rows, setRows] = useState<string[][]>([]);
  useEffect(() => {
    const update = () => setRows(read(allowance));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    window.visualViewport?.addEventListener("resize", update);
    const t = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.clearInterval(t);
    };
  }, [allowance]);
  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        left: 8,
        zIndex: 2000,
        padding: "6px 8px",
        borderRadius: 8,
        background: "rgba(20,20,20,.82)",
        color: "#fff",
        font: "12px/1.35 ui-monospace, Menlo, monospace",
        pointerEvents: "none",
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k}>
          {k}: {v}
        </div>
      ))}
    </div>
  );
}
