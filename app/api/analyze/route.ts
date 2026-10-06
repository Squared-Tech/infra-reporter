import { NextResponse } from "next/server";

const SYSTEM = `You assess photos of public infrastructure problems in Zambian towns for a city council.
Return ONLY a JSON object, no other text:
{"category": "pothole|blocked_drain|power_fault|water_leak|other|not_infrastructure",
 "severity": 1-5 integer,
 "reason": "one short sentence",
 "suggested_action": "one short sentence"}
Severity: 1 minor/cosmetic, 2 small nuisance, 3 moderate disruption, 4 serious hazard or major disruption, 5 immediate danger to life (live wires, deep road hole, flooding).`;

const MODEL = "gemini-3.5-flash";

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: image } },
                { text: "Assess this photo." },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      console.error(data);
      return NextResponse.json({ error: "analysis failed" }, { status: 500 });
    }
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("");
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(json);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}