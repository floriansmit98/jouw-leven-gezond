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
            content: `Je bent een voedselherkenner. Bekijk de foto en identificeer alle zichtbare voedingsmiddelen en dranken.
Geef voor elk item de Nederlandse naam zoals je die in een voedingsdatabase zou zoeken (bijv. "kipfilet", "witte rijst", "broccoli", "appelsap").
Schat ook de hoeveelheid in grammen of milliliters.
Geef alleen de namen en geschatte hoeveelheden terug, GEEN voedingswaarden.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Welke voedingsmiddelen zie je op deze foto? Geef de Nederlandse namen en geschatte hoeveelheden.",
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
        tools: [
          {
            type: "function",
            function: {
              name: "identify_foods",
              description: "Return the list of identified foods from the photo with Dutch names and estimated amounts.",
              parameters: {
                type: "object",
                properties: {
                  foods: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        naam: {
                          type: "string",
                          description: "Dutch name of the food as you would search in a nutrition database, e.g. 'kipfilet', 'witte rijst', 'broccoli'"
                        },
                        hoeveelheid_gram: {
                          type: "number",
                          description: "Estimated amount in grams (or ml for liquids)"
                        },
                        is_drank: {
                          type: "boolean",
                          description: "Whether this is a drink/liquid"
                        }
                      },
                      required: ["naam", "hoeveelheid_gram", "is_drank"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["foods"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "identify_foods" } },
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
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      // Fallback: try to parse content as JSON
      const content = data.choices?.[0]?.message?.content || "";
      console.error("No tool call in response, content:", content);
      return new Response(JSON.stringify({ error: "Kon geen voedingsmiddelen herkennen. Probeer een duidelijkere foto." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse tool call arguments:", toolCall.function.arguments);
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
