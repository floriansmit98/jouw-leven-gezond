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

BELANGRIJK - Samengestelde gerechten:
Veel zoekopdrachten bevatten meerdere ingrediënten, bijv.:
- "broodje zalm" → dit is GEEN enkel product, maar twee componenten: "broodje" + "zalm"
- "boterham met kaas" → twee componenten: "brood" + "kaas"
- "tosti ham kaas" → drie componenten: "brood" + "ham" + "kaas"
- "wrap kip" → twee componenten: "wrap" + "kip"
- "salade tonijn" → twee componenten: "sla" + "tonijn"
- "yoghurt met muesli" → twee componenten: "yoghurt" + "muesli"
- "havermout met banaan" → twee componenten: "havermout" + "banaan"

Als een zoekopdracht een samengesteld gerecht beschrijft (meerdere ingrediënten), stel dan is_compound = true en geef de losse componenten terug met hun eigen zoektermen.

Als het één enkel product is (bijv. "stroopwafel", "frikandel", "katjang pedis", "cola"), stel dan is_compound = false.

De NEVO-database bevat generieke Nederlandse voedingsmiddelen. Voorbeelden van mappings:
- "Calvé pindakaas" → zoek op "pindakaas"
- "Doritos" → zoek op "tortillachips"  
- "Coca Cola" → zoek op "cola"
- "Cup-a-Soup" → zoek op "kippensoep" of "soep"
- "Fanta" → zoek op "frisdrank sinaasappel"
- "Nutella" → zoek op "chocoladepasta"
- "Red Bull" → zoek op "energiedrank"
- "katjang pedis" → zoek op "katjang pedis"
- "bitterballen" → zoek op "bitterballen"
- "frikandel" → zoek op "frikandel"
- "kroket" → zoek op "kroket"

Belangrijk:
- Herken ook alternatieve spellingen, synoniemen en informele namen.
- Geef altijd meerdere zoektermen zodat we de beste match kunnen vinden.
- Bij samengestelde gerechten: geef per component de beste zoektermen.`
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
                    description: "Het merk als herkend (bijv. 'Calvé', 'Doritos'). Leeg als geen merk."
                  },
                  product_type: {
                    type: "string",
                    description: "Het producttype in het Nederlands (bijv. 'pindakaas', 'broodje zalm')"
                  },
                  is_drink: {
                    type: "boolean",
                    description: "True als het een drank is"
                  },
                  is_compound: {
                    type: "boolean",
                    description: "True als de zoekopdracht een samengesteld gerecht is met meerdere ingrediënten (bijv. 'broodje zalm', 'tosti ham kaas'). False als het één enkel product is (bijv. 'stroopwafel', 'cola')."
                  },
                  nevo_search_terms: {
                    type: "array",
                    items: { type: "string" },
                    description: "Zoektermen voor het hele product. Bij samengestelde gerechten: zoek eerst op het volledige gerecht."
                  },
                  components: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Naam van het component (bijv. 'broodje', 'zalm')"
                        },
                        search_terms: {
                          type: "array",
                          items: { type: "string" },
                          description: "Zoektermen voor dit component in de NEVO-database"
                        },
                        is_drink: {
                          type: "boolean",
                          description: "True als dit component een drank is"
                        }
                      },
                      required: ["name", "search_terms", "is_drink"]
                    },
                    description: "Alleen invullen als is_compound = true. Lijst van losse ingrediënten/componenten."
                  },
                  display_message: {
                    type: "string",
                    description: "Korte Nederlandse zin voor de gebruiker. Bij samengestelde gerechten: 'Ik herken: broodje + zalm'. Bij enkelvoudig: 'Dit is een stroopwafel.'"
                  }
                },
                required: ["product_type", "is_drink", "is_compound", "nevo_search_terms", "display_message"],
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
