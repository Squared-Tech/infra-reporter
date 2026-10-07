import { NextResponse } from "next/server";

const SYSTEM = `You assess photos of community problems in Zambian towns for a city council. Problems include infrastructure, waste, water, animals, crime and safety.
Return ONLY a JSON object, no other text:
{"category": "<one of: pothole|road_damage|street_light_out|blocked_drain|water_leak|sewage|illegal_dumping|litter|stray_animal|dead_animal|animal_attack|petty_crime|vandalism|fire_hazard|person_in_danger|downed_powerline|power_fault|other|not_infrastructure>",
 "department": "<one of: fire_rescue|police|solid_waste|water_sanitation|veterinary|road_maintenance|general>",
 "severity": 1-5 integer,
 "reason": "one short sentence",
 "suggested_action": "one short sentence"}
Category guidance:
- person_in_danger = a PERSON (e.g. a baby or child) trapped, fallen or stuck (in a well, hole, drain, pit). This is NOT blocked_drain. If any person is in danger use person_in_danger, department fire_rescue, severity 5.
- blocked_drain = a drain/ditch blocked with debris and NO person in it.
- stray_animal = live animal roaming (dog, cat, cattle, goat). dead_animal = animal carcass. animal_attack = animal threatening or biting people.
- petty_crime/vandalism = theft, break-in damage, destroyed public property.
- downed_powerline = fallen or sparking electrical line (department fire_rescue, severity 5).
Department must match the category: pothole/road_damage/street_light_out->road_maintenance; blocked_drain/water_leak/sewage->water_sanitation; illegal_dumping/litter->solid_waste; stray_animal/dead_animal/animal_attack->veterinary; petty_crime/vandalism->police; fire_hazard/person_in_danger/downed_powerline/power_fault->fire_rescue; else general.
Severity: 1 minor/cosmetic, 2 small nuisance, 3 moderate disruption, 4 serious hazard or major disruption, 5 immediate danger to life.`;

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