
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
      prompt = `ANALYSE CARTE GRISE MAROC :
      - Extrait le NIV (champ E).
      - Extrait la MARQUE (champ D.1).
      - Extrait le MODÈLE (champ D.3) : TRÈS IMPORTANT. Convertis tout code technique ou variante en APPELLATION COMMERCIALE STANDARD (ex: au lieu d'un code interne, écris "MG4", "MG ZS", "DACIA DUSTER", "RENAULT EXPRESS").
      - Extrait l'ANNÉE (champ B).
      - Extrait l'IMMATRICULATION (champ A).
      Réponds UNIQUEMENT au format JSON.`;
    } else {
      prompt = `ANALYSE PHOTO VÉHICULE / ÉTIQUETTE NIV :
      1. NIV (VIN) : Extrait les 17 caractères avec précision.
      2. MARQUE : Identifie le constructeur (ex: MG, DACIA, RENAULT, HYUNDAI).
      3. MODÈLE : Identifie l'APPELLATION COMMERCIALE STANDARD et OFFICIELLE du constructeur.
         RÈGLE CRITIQUE : Sois précis sur les noms commerciaux. Pour MG, distingue clairement selon le design ou le VIN s'il s'agit d'une "MG4", "MG ZS", "MG HS", "MG5", etc. Ne fournis pas de noms de châssis génériques.
      4. ANNÉE : Extrait l'année si visible sur l'étiquette.
      Réponds UNIQUEMENT au format JSON.`;
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
            make: { type: Type.STRING, description: "Marque officielle constructeur" },
            model: { type: Type.STRING, description: "Nom commercial standard du modèle" },
            year: { type: Type.STRING, description: "Année" },
          },
          required: ["vin", "make", "model"]
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      return new Response(JSON.stringify({ error: "Aucune donnée extraite. Image illisible ?" }), { status: 200 });
    }

    return new Response(resultText, {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Le serveur a rencontré un problème technique." }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
