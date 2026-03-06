import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Geen afbeelding ontvangen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Je bent een voedingsdeskundige gespecialiseerd in diëten voor dialysepatiënten.
Analyseer de foto van een maaltijd en geef een schatting van de voedingsstoffen.

Antwoord ALTIJD in dit exacte JSON-formaat, zonder extra tekst:
{
  "naam": "Naam van het gerecht",
  "items": [
    {
      "naam": "Voedingsmiddel",
      "portie": "geschatte portie",
      "kalium": 0,
      "fosfaat": 0,
      "natrium": 0,
      "eiwit": 0,
      "vocht": 0
    }
  ],
  "totaal": {
    "kalium": 0,
    "fosfaat": 0,
    "natrium": 0,
    "eiwit": 0,
    "vocht": 0
  },
  "waarschuwingen": ["eventuele waarschuwingen voor dialysepatiënten"],
  "advies": "Kort advies in simpel Nederlands"
}

Kalium, fosfaat en natrium in mg. Eiwit in gram. Vocht in ml.
Wees realistisch met de schattingen. Geef waarschuwingen als een voedingsmiddel veel kalium, fosfaat of natrium bevat.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyseer deze maaltijd en schat de voedingsstoffen. Geef het resultaat als JSON.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken. Probeer het later opnieuw." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Geen tegoed meer. Voeg credits toe in je Lovable werkruimte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Er ging iets mis bij de analyse." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Kon het resultaat niet verwerken. Probeer een duidelijkere foto." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-meal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
