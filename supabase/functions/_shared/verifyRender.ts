// A second look at a finished render: does it still show the building of the photograph it was made from, or has the renderer put a generic ruined building of that kind in its place?
// Asked of a small, cheap model. If the check cannot be made (no key, the service is down) the render is accepted: the check never blocks anything.

const toBase64 = (bytes: Uint8Array): string => { let t = ''; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(t); };

export async function keepsBuilding(original: { bytes: Uint8Array; mime: string }, render: Uint8Array): Promise<boolean> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return true;
  const model = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-2.5-flash';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: 'Picture 1 is a photograph of a place. Picture 2 is a video-game render of that same place after it was destroyed. Does the main building (or main structure) in picture 2 keep the recognizable shape, layout and features of the main building in picture 1 (its outline, number of floors, roofline, wings or towers, facade), only wrecked, or is picture 2 a different, generic ruined building? Answer with exactly one word: SAME or DIFFERENT.' },
          { inline_data: { mime_type: original.mime, data: toBase64(original.bytes) } },
          { inline_data: { mime_type: 'image/png', data: toBase64(render) } },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
    });
    if (!res.ok) return true;
    const body = await res.json();
    const text = String(body.candidates?.[0]?.content?.parts?.[0]?.text ?? '').toUpperCase();
    return !text.includes('DIFFERENT');
  } catch { return true; }
}
