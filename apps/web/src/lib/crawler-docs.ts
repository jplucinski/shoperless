import type { Product } from "@liteshop/core";
import { descriptionFor, titleFor } from "./product-photos.ts";

const BLOCKED = ["/admin", "/api", "/cart"];

export function robotsTxt(origin: string): string {
  const llms = new URL("/llms.txt", origin).href;
  return [
    "# Storefront is open to crawlers, including GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Amazonbot, and Applebot-Extended.",
    "User-agent: *",
    "Allow: /",
    ...BLOCKED.map((path) => `Disallow: ${path}`),
    "",
    `# llms.txt: ${llms}`,
    "",
  ].join("\n");
}

function oneLine(value: string, max = 180): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

function linkLabel(value: string): string {
  return value.replace(/[\[\]]/g, "");
}

export function llmsTxt(origin: string, products: Product[]): string {
  const page = (path: string) => new URL(path, origin).href;
  const works = products.map((product) => {
    const blurb = oneLine(descriptionFor(product));
    const suffix = blurb ? `: ${blurb}` : "";
    return `- [${linkLabel(titleFor(product))}](${page(`/products/${product.slug}`)})${suffix}`;
  });
  return [
    "# LiteShop",
    "",
    "> Pracownia obrazu i rysunku. Każda praca jest jednym egzemplarzem i schodzi z katalogu po sprzedaży.",
    "",
    "Ceny są w PLN. Język sklepu: polski. Nie ma serii ani dodruku.",
    "",
    "## Strony",
    "",
    `- [Start](${page("/")}): najnowsza praca i wejście do katalogu`,
    `- [Prace](${page("/prace")}): aktywne prace`,
    `- [Kontakt](${page("/kontakt")}): pytania o zamówienie, reklamację i dane osobowe`,
    `- [Regulamin](${page("/regulamin")}): zasady sprzedaży przez Furgonetka Koszyk`,
    `- [RODO](${page("/rodo")}): ochrona danych zamówienia`,
    "",
    "## Prace",
    "",
    works.length > 0 ? works.join("\n") : "Katalog jest pusty.",
    "",
  ].join("\n");
}
