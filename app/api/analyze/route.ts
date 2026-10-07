import { NextResponse } from "next/server";

const SYSTEM = `You assess photos of public infrastructure problems in Zambian towns for a city council.
Return ONLY a JSON object, no other text:
{"category": "pothole|blocked_drain|power_fault|water_leak|other|not_infrastructure",
 "severity": 1-5 integer,
 "reason": "one short sentence",
 "suggested_action": "one short sentence"}
Severity: 1 minor/cosmetic, 2 small nuisance, 3 moderate disruption, 4 serious hazard or major disruption, 5 immediate danger to life (live wires, deep road hole, flooding).`;

const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
  }
  try {
    const { image } = await req.json();
    let lastError = "AI analysis failed";

    for (const model of MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
        lastError = `${model}: ${data?.error?.message ?? r.status}`;
        console.error(lastError);
        continue;
      }
      try {
        const text = (data.candidates?.[0]?.content?.parts ?? [])
          .map((p: any) => p.text ?? "")
          .join("");
        const json = JSON.parse(text.replace(/```json|```/g, "").trim());
        return NextResponse.json(json);
      } catch {
        lastError = `${model}: could not read the AI response`;
        console.error(lastError);
      }
    }
    return NextResponse.json({ error: lastError }, { status: 500 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}