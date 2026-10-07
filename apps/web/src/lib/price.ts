import { z } from "zod";

const priceStringSchema = z.string().trim().min(1);

export function parsePriceGrosze(raw: string): number {
  const value = priceStringSchema.parse(raw);
  const normalized = value.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "invalid price",
        path: ["priceZloty"],
      },
    ]);
  }
  const [whole, frac = ""] = normalized.split(".");
  const grosze = Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
  if (!Number.isSafeInteger(grosze) || grosze <= 0) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "invalid price",
        path: ["priceZloty"],
      },
    ]);
  }
  return grosze;
}
