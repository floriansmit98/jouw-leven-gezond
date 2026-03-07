import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function classifyRisk(potassium: number): string {
  if (potassium >= 300) return "hoog";
  if (potassium >= 150) return "gemiddeld";
  return "laag";
}

function parseAliases(synonym: string | undefined): string[] {
  if (!synonym || synonym.trim() === "") return [];
  return synonym.split("/").map((s) => s.trim()).filter(Boolean);
}

function categorize(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("aardappel") || n.includes("frites") || n.includes("chips") || n.includes("rosti") || n.includes("puree")) return "aardappelen";
  if (n.includes("melk") || n.includes("yoghurt") || n.includes("kaas") || n.includes("kwark") || n.includes("room") || n.includes("vla") || n.includes("boter")) return "zuivel";
  if (n.includes("brood") || n.includes("beschuit") || n.includes("cracker") || n.includes("knackebrod") || n.includes("toast") || n.includes("wrap") || n.includes("tortilla")) return "brood & granen";
  if (n.includes("kip") || n.includes("rund") || n.includes("varkens") || n.includes("lams") || n.includes("kalfs") || n.includes("gehakt") || n.includes("worst") || n.includes("ham") || n.includes("spek") || n.includes("bacon") || n.includes("vlees")) return "vlees";
  if (n.includes("vis") || n.includes("zalm") || n.includes("kabeljauw") || n.includes("tonijn") || n.includes("haring") || n.includes("garnaal") || n.includes("makreel") || n.includes("mossel") || n.includes("kreeft")) return "vis & zeevruchten";
  if (n.includes("appel") || n.includes("banaan") || n.includes("sinaas") || n.includes("peer") || n.includes("aardbei") || n.includes("druiv") || n.includes("kers") || n.includes("pruim") || n.includes("fruit") || n.includes("citroen") || n.includes("mango") || n.includes("kiwi") || n.includes("meloen")) return "fruit";
  if (n.includes("kool") || n.includes("sla") || n.includes("spinazie") || n.includes("broccoli") || n.includes("wortel") || n.includes("tomaat") || n.includes("paprika") || n.includes("ui") || n.includes("prei") || n.includes("biet") || n.includes("komkommer") || n.includes("courgette") || n.includes("groente")) return "groente";
  if (n.includes("bonen") || n.includes("erwten") || n.includes("linzen") || n.includes("kikkererwt")) return "peulvruchten";
  if (n.includes("noten") || n.includes("pinda") || n.includes("amandel") || n.includes("cashew") || n.includes("walnoot") || n.includes("hazel")) return "noten & zaden";
  if (n.includes("pasta") || n.includes("rijst") || n.includes("couscous") || n.includes("bulgur") || n.includes("haver") || n.includes("muesli") || n.includes("ontbijt") || n.includes("bloem") || n.includes("meel")) return "granen & pasta";
  if (n.includes("koek") || n.includes("cake") || n.includes("taart") || n.includes("biscuit") || n.includes("chocola") || n.includes("snoep") || n.includes("drop") || n.includes("ijs") || n.includes("pudding") || n.includes("wafel")) return "zoet & gebak";
  if (n.includes("bier") || n.includes("wijn") || n.includes("jenever") || n.includes("whisky") || n.includes("cognac") || n.includes("rum") || n.includes("vodka") || n.includes("likeur")) return "alcohol";
  if (n.includes("sap") || n.includes("frisdrank") || n.includes("limonade") || n.includes("koffie") || n.includes("thee") || n.includes("water") || n.includes("energie") || n.includes("drink") || n.includes("smoothie")) return "dranken";
  if (n.includes("saus") || n.includes("ketchup") || n.includes("mayo") || n.includes("mosterd") || n.includes("dressing") || n.includes("jus") || n.includes("bouillon")) return "sauzen & kruiden";
  if (n.includes("olie") || n.includes("vet") || n.includes("margarine") || n.includes("halvarine")) return "oliën & vetten";
  if (n.includes("soep")) return "soepen";
  if (n.includes("ei") && (n.startsWith("ei ") || n.includes("eieren") || n.includes("eidooier") || n.includes("eiwit"))) return "eieren";
  return "overig";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { rows, clear } = await req.json();

    if (clear) {
      // Delete all existing foods
      const { error: delErr } = await supabase.from("foods").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // rows is an array of: { name, synonym, portion, water, protein, sodium, potassium, phosphorus }
    const foodItems = rows.map((r: any) => ({
      name: r.name,
      category: categorize(r.name),
      portion_description: r.portion || "per 100g",
      portion_grams: 100,
      potassium_mg: parseFloat(r.potassium) || 0,
      phosphate_mg: parseFloat(r.phosphorus) || 0,
      sodium_mg: parseFloat(r.sodium) || 0,
      protein_g: parseFloat(r.protein) || 0,
      fluid_ml: parseFloat(r.water) || 0,
      dialysis_risk_label: classifyRisk(parseFloat(r.potassium) || 0),
      aliases: parseAliases(r.synonym),
    }));

    // Insert in batches of 200
    let inserted = 0;
    for (let i = 0; i < foodItems.length; i += 200) {
      const batch = foodItems.slice(i, i + 200);
      const { error } = await supabase.from("foods").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
