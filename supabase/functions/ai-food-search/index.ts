import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Query te kort" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            content: `Je bent een Nederlandse voedingsassistent voor nierpatiënten. 
Je taak: interpreteer productzoektermen van gebruikers en geef gestructureerde zoektermen terug om te matchen met de NEVO-voedingsdatabase.

De NEVO-database bevat generieke Nederlandse voedingsmiddelen zoals:
- "pindakaas" (niet "Calvé pindakaas")
- "stroopwafel" (niet "Jumbo stroopwafel")  
- "tortillachips" (niet "Doritos")
- "cola frisdrank" of "frisdrank" (niet "Coca Cola")
- "kippensoep" (niet "Cup-a-Soup")
- "frisdrank sinaasappel" (niet "Fanta")
- "chocoladepasta" (niet "Nutella")
- "energiedrank" (niet "Red Bull")
- "ijsthee" (niet "Lipton Ice Tea")
- "hagelslag" (niet "De Ruijter")
- "mayonaise" (niet "Hellmann's")
- "ketchup" (niet "Heinz ketchup")

Geef altijd meerdere zoektermen zodat we de beste match kunnen vinden.`
          },
          {
            role: "user",
            content: query.trim(),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "interpret_food_query",
              description: "Interpreteer een voedselzoekopdracht en geef zoektermen voor de NEVO-database.",
              parameters: {
                type: "object",
                properties: {
                  brand: {
                    type: "string",
                    description: "Het merk als herkend (bijv. 'Calvé', 'Doritos', 'Jumbo'). Leeg als geen merk."
                  },
                  product_type: {
                    type: "string",
                    description: "Het producttype in het Nederlands (bijv. 'pindakaas', 'tortillachips', 'stroopwafel')"
                  },
                  is_drink: {
                    type: "boolean",
                    description: "True als het een drank is (frisdrank, sap, melk, thee, koffie, water, bier, wijn, etc.)"
                  },
                  nevo_search_terms: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lijst van zoektermen om in de NEVO-database te zoeken, van meest specifiek naar generiek. Bijv. ['pindakaas', 'notenpasta'] of ['tortillachips', 'chips', 'nachochips']"
                  },
                  display_message: {
                    type: "string",
                    description: "Korte Nederlandse zin voor de gebruiker die uitlegt wat je hebt herkend. Bijv. 'Ik herken dit als pindakaas van Calvé.' of 'Dit is een stroopwafel.'"
                  }
                },
                required: ["product_type", "is_drink", "nevo_search_terms", "display_message"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "interpret_food_query" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Tegoed onvoldoende." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-fout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Kon de zoekopdracht niet interpreteren." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-food-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
