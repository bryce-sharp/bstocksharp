import * as React from "react";

const noopSubscribe = () => () => {};

/** Keeps the screen on while `active`, asking again when the page comes back; "unavailable" when unsupported or refused. */
export function useWakeLock(active: boolean): "on" | "off" | "unavailable" {
  const supported = React.useSyncExternalStore(noopSubscribe, () => "wakeLock" in navigator, () => true);
  const [held, setHeld] = React.useState<"on" | "off" | "denied">("off");
  React.useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const acquire = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (!live) return void l.release();
          lock = l;
          setHeld("on");
          l.addEventListener("release", () => setHeld("off"));
        })
        .catch(() => setHeld("denied"));
    void acquire();
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active, supported]);
  return !supported || held === "denied" ? "unavailable" : held;
}
