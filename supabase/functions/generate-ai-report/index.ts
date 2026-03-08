import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "npm:openai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo non supportato." }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const payload = await req.json();

    if (!Deno.env.get("OPENAI_API_KEY")) {
      throw new Error("OPENAI_API_KEY non configurata nei secrets di Supabase.");
    }

    const prompt = `
Sei un analista di spese personali.

Devi scrivere una vera analisi dei dati, non un dump di informazioni.

Regole:
- Scrivi in italiano.
- Tono professionale, chiaro, concreto.
- Non inventare dati non presenti nel payload.
- Non limitarti a ripetere numeri e classifiche.
- Interpreta i dati in modo discorsivo.
- Evidenzia prima i fattori principali e poi quelli secondari.
- Commenta le anomalie in modo contestualizzato.
- Analizza le spese ricorrenti confrontando periodo corrente e periodo precedente.
- Evidenzia aumenti, diminuzioni, stabilità, voci mancanti e nuove voci ricorrenti.
- Commenta le crescite principali spiegando il loro impatto reale.
- Chiudi con una sintesi finale.
- Non usare elenchi puntati.
- Restituisci un testo leggibile in un PDF gestionale.

Restituisci SOLO un JSON conforme allo schema richiesto.
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(payload) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ai_report_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              overview: { type: "string" },
              anomalies: { type: "string" },
              recurring: { type: "string" },
              growth: { type: "string" },
              conclusion: { type: "string" }
            },
            required: ["overview", "anomalies", "recurring", "growth", "conclusion"]
          }
        }
      }
    });

    const json = JSON.parse(response.output_text || "{}");

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
