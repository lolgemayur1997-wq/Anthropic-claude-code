import type { Adapter, AdapterName } from "./types.ts";

export async function loadAdapter(name: AdapterName): Promise<Adapter> {
  switch (name) {
    case "mock":
      return (await import("./mock.ts")).default;
    case "kite":
      return (await import("./kite.ts")).default;
    case "upstox":
      return (await import("./upstox.ts")).default;
    case "dhan":
      return (await import("./dhan.ts")).default;
    default:
      throw new Error(`Unknown adapter: ${name}`);
  }
}
