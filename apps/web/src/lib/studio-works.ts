export const STUDIO_WORKS = [
  {
    sku: "TOWEL-BLUE",
    slug: "blue-towel",
    name: "Niebieskie pole",
    artist: "Lena Wrzesień",
    description: "Obraz. Jeden egzemplarz.",
    images: ["/works/cobalt.png", "/works/plaster.png"],
    price: 19900,
  },
  {
    sku: "TOWEL-SAND",
    slug: "sand-towel",
    name: "Szary rysunek",
    artist: "Oskar Bielik",
    description: "Rysunek węglem. Jeden egzemplarz.",
    images: ["/works/charcoal.png", "/works/plaster.png"],
    price: 17900,
  },
] as const;

export function studioWork(slug: string) {
  return STUDIO_WORKS.find((work) => work.slug === slug);
}

export function studioBySku(sku: string) {
  return STUDIO_WORKS.find((work) => work.sku === sku);
}
