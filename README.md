# RadMaps

Turn the city you live in into a wasteland map. Type a city (or press ME for your position) and RadMaps shows it the way a post-apocalyptic
survival game would: roads and buildings in Pip-Boy phosphor green or faded parchment, a vault nearby, irradiated zones, and every school,
hospital, market and park renamed as a wasteland location.

**An unofficial fan project.** Fallout is a trademark of Bethesda Softworks LLC. RadMaps is not affiliated with or endorsed by Bethesda or
Microsoft, and uses no game artwork: the icons and names are original.

## Run it

```
npm install
cp .env.example .env.local     # then paste your Google key after VITE_GOOGLE_MAPS_API_KEY=
npm run dev                    # http://localhost:5173
```

Without a key the page still opens and tells you what to set up.

### The Google key

In Google Cloud Console, enable these three APIs for the project: **Maps JavaScript API**, **Geocoding API**, **Places API (New)**. Create an
API key, restrict it to **HTTP referrers** (`http://localhost:5173/*` now, your .com when it exists) and to those three APIs. Billing must be on.

## What it does

- **Two looks, one toggle.** Pip-Boy (green on black, scanlines, glow) and Parchment (faded paper, ink). Each is a Google Maps style plus
  an overlay drawn on top by the page.
- **Search any city or address**, geocoded by Google. Starting points for Boston, Washington, Las Vegas, Charleston, Seattle and Chicago.
- **Wasteland generator** (`src/lib/wasteland.ts`): deterministic from the city, so the same city always has the same vault number, radiation
  zones and names, and a shared link shows everyone the same map.
- **Real places become locations.** Five Places lookups per city (hospitals, schools, markets, parks, cantinas and so on) are renamed by
  category, each with the old name kept ("formerly Boston Public Library"), a threat and some loot.
- **Locations panel** with category filters and a list sorted by distance; clicking a row flies to it. **Data panel** with region, coordinates,
  vault, zones. **Share panel** with a link that reopens the same place and look, and a print-ready poster.

## Cost and Google's rules

- A city costs one geocode and five Places lookups. Results are remembered for the browser session, so reopening the same city is free.
- Google restricts how its map imagery may be used: styled maps and overlays like these are fine, but the map tiles themselves may not be
  copied, recolored as images, stored, or sold. So "Print poster" prints the live page for personal use; selling prints would need a map source
  that allows it (for example OpenStreetMap data), which is a different base layer.

## Layout

```
src/lib/google.ts      loads Maps; geocoding; Places lookups (cached per session)
src/lib/looks.ts       the two map styles and their colors
src/lib/wasteland.ts   names, categories, vault, radiation zones (pure, deterministic)
src/lib/htmlMarker.ts  HTML map markers (glow, labels)
src/lib/icons.ts       original line icons
src/lib/share.ts       the shareable link
src/components/        MapView, SearchBar, the three panels, the setup notice
_tools/                dev checks: smoke.mjs (browser test against a fake Google), wasteland.check.ts
```

## Checks

```
npx tsx _tools/wasteland.check.ts                        # generator logic
VITE_GOOGLE_MAPS_API_KEY=dummy npx vite --port 5174 &    # then:
node _tools/smoke.mjs                                    # drives Chrome against a fake Google: search, pins, filters, looks, share link, phone layout
```
