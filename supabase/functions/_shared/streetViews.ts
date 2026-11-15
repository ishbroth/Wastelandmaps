// The Street View picture for a place that has no free photograph. The map point of many places (a park, a campus, a district) is only roughly where the thing is, and Street View's camera
// facing "toward" it often shows a road, a field or a car. So several views are taken (toward the point, and either side of it, or all round when the camera stands on the point itself)
// and a small, cheap model picks the one that really shows the place. If none does, there is no usable picture (null), and the caller treats the place as having no photo.
// If the picking cannot be done (no key, the service is down) the view straight toward the point is used, as before.

export interface StreetPicture { bytes: Uint8Array; mime: string }

const toBase64 = (bytes: Uint8Array): string => { let t = ''; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(t); };

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r);
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number =>
  Math.hypot((b.lat - a.lat) * 111320, (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

export async function bestStreetView(lat: number, lng: number, name: string, kind: string): Promise<StreetPicture | null> {
  const key = Deno.env.get('STREETVIEW_API_KEY');
  if (!key) return null;
  const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${new URLSearchParams({ location: `${lat},${lng}`, radius: '60', source: 'outdoor', key })}`)).json();
  if (meta.status !== 'OK' || !meta.location) return null;
  const at = { lat: meta.location.lat as number, lng: meta.location.lng as number };
  const near = metresBetween(at, { lat, lng }) < 8; // the camera stands on the point: which way the place lies is not known
  const toward = Math.round(bearing(at, { lat, lng }));
  const headings = near ? [0, 90, 180, 270] : [toward, (toward + 300) % 360, (toward + 60) % 360];
  const pictures: StreetPicture[] = [];
  for (const heading of headings) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/streetview?${new URLSearchParams({ size: '640x640', location: `${at.lat},${at.lng}`, heading: String(heading), pitch: '6', fov: '90', source: 'outdoor', return_error_codes: 'true', key })}`);
      if (res.ok) pictures.push({ bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/jpeg' });
    } catch { /* that view is left out */ }
  }
  if (pictures.length === 0) return null;
  const gemini = Deno.env.get('GEMINI_API_KEY');
  if (!gemini) return pictures[0];
  try {
    const model = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-flash-latest';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': gemini, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `These ${pictures.length} pictures are Google Street View views taken near a place called "${name}" (${kind}). Which one shows that place itself (its building, entrance, gate, monument or main structure) clearly enough that a picture of the place could be made from it? A view of only a road, an empty field, trees, a fence, water, a parked vehicle or some other building does not count. Reply in exactly this form and nothing else: ANSWER: <the number of the best picture, 1 to ${pictures.length}, or NONE if no picture shows the place>` },
          ...pictures.flatMap((p, i) => [{ text: `Picture ${i + 1}:` }, { inline_data: { mime_type: p.mime, data: toBase64(p.bytes) } }]),
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) return pictures[0];
    const body = await res.json();
    const text = String(body.candidates?.[0]?.content?.parts?.[0]?.text ?? '').toUpperCase();
    const said = /ANSWER:[ ]*(NONE|[1-9])/.exec(text)?.[1];
    if (said === 'NONE') return null;
    const n = Number(said);
    return n >= 1 && n <= pictures.length ? pictures[n - 1] : pictures[0]; // an answer that cannot be read: the view straight toward the point
  } catch { return pictures[0]; }
}
