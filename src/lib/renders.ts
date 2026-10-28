// The post-apocalyptic game-style renders that everyone can see for free: a few of the world's best-known landmarks, re-rendered from a freely
// licensed Wikimedia Commons photo by an image model (see _tools/gen-test.mjs). Keyed by Wikidata id. Every other place's render is a paid extra.
// The photo's author and license stay with the render: most are CC BY-SA, so the render is shared under the same license.

export interface FreeRender {
  name: string;
  /** The photo it was made from. */
  photo: string;
  author: string;
  license: string;
  page: string;
}

export const FREE_RENDERS: Record<string, FreeRender> = {
  Q243: { name: "Eiffel Tower", photo: "Tour Eiffel Wikimedia Commons", author: "Benh LIEU SONG", license: "Public domain", page: "https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons.jpg" },
  Q9202: { name: "Statue of Liberty", photo: "Statue of Liberty and a sightseeing boat, Liberty Island, New York", author: "Christian David", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Statue_of_Liberty_and_a_sightseeing_boat,_Liberty_Island,_New_York.jpg" },
  Q5317: { name: "Space Needle", photo: "Seattle, October 6, 2023 - 60", author: "Another Believer", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Seattle,_October_6,_2023_-_60.jpg" },
  Q41225: { name: "Big Ben", photo: "Elizabeth Tower and the north front of the Palace of Westminster, London", author: "Christian David", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Elizabeth_Tower_and_the_north_front_of_the_Palace_of_Westminster,_London.jpg" },
  Q45178: { name: "Sydney Opera House", photo: "00 1375 Sydney Opera House (Australia)", author: "W. Bulach", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:00_1375_Sydney_Opera_House_(Australia).jpg" },
  Q79961: { name: "Christ the Redeemer", photo: "Christ the Redeemer - Cristo Redentor", author: "Arne Müseler", license: "CC BY-SA 3.0 de", page: "https://commons.wikimedia.org/wiki/File:Christ_the_Redeemer_-_Cristo_Redentor.jpg" },
  Q133274: { name: "The Kremlin, Moscow", photo: "Moscow 05-2012 Kremlin 22", author: "A.Savin", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Moscow_05-2012_Kremlin_22.jpg" },
};

/** The free render for a place on the map, by its id ("wd:Q243"), or undefined. */
export function freeRenderFor(spotId: string): (FreeRender & { url: string }) | undefined {
  if (!spotId.startsWith('wd:')) return undefined;
  const id = spotId.slice(3);
  const hit = FREE_RENDERS[id];
  return hit ? { ...hit, url: `${import.meta.env.BASE_URL}renders/${id}.png` } : undefined;
}
