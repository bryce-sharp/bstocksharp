import * as React from "react";

const noopSubscribe = () => () => {};

/** False on the server and while hydrating, true right after, without setting state in an effect. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}
