import { Resource } from "sst";
import { koszykCheckoutScriptSrc } from "./koszyk-script.ts";

export { koszykCheckoutScriptSrc };

export function koszykCheckoutUuid(): string | undefined {
  try {
    const value = Resource.KoszykCheckoutUuid.value.trim();
    return value.length > 0 ? value : undefined;
  } catch (error) {
    if (import.meta.env.DEV) return undefined;
    throw error;
  }
}
