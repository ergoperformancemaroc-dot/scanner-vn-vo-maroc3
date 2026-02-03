
import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { image, mode, businessType, mimeType = 'image/jpeg' } = body;
    
    if (!process.env.API_KEY) {
      return new Response(JSON.stringify({ error: "Clé API Gemini manquante. Configurez API_KEY." }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = "";
    if (mode === 'carte_grise') {
      prompt = "CARTE GRISE MAROC : Extrait le NIV (champ E), la Marque (D.1), le Modèle (D.3), l'Année (B), et l'Immat (A). JSON uniquement.";
    } else {
      prompt = `ANALYSE PHOTO CHÂSSIS/VÉHICULE :
      1. Trouve impérativement le NIV (VIN) de 17 caractères gravé ou sur étiquette.
      2. Identifie la MARQUE du constructeur (cherche le logo, ex: MG, Renault, Peugeot).
      3. Identifie le MODÈLE le plus probable.
      4. Détermine l'ANNÉE si elle apparaît sur l'étiquette NIV.
      Réponds UNIQUEMENT en JSON valide. Ne fournis aucun texte avant ou après.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vin: { type: Type.STRING, description: "Numéro de châssis exact" },
            plate: { type: Type.STRING, description: "Immatriculation" },
            make: { type: Type.STRING, description: "Marque constructeur" },
            model: { type: Type.STRING, description: "Modèle précis" },
            year: { type: Type.STRING, description: "Année" },
          },
          required: ["vin"]
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      return new Response(JSON.stringify({ error: "Impossible de lire les données. Image floue ou reflet ?" }), { status: 200 });
    }

    return new Response(resultText, {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Le serveur a rencontré un problème. Vérifiez la connexion." }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
