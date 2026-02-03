
import { GeminiResponse, ScanType, BusinessType } from "../types";

export const extractVehicleData = async (
  base64Image: string, 
  mode: ScanType = 'vin',
  businessType: BusinessType = 'VO',
  mimeType: string = 'image/jpeg'
): Promise<GeminiResponse> => {
  try {
    const response = await fetch('/api/analyze-vin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, mode, businessType, mimeType }),
    });

    // On vérifie d'abord si le serveur renvoie une erreur brute (souvent du HTML)
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("L'image est trop lourde pour être traitée. Réessayez avec une photo moins zoomée.");
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur serveur (${response.status})`);
      } else {
        throw new Error(`Erreur réseau : le serveur a répondu ${response.status}.`);
      }
    }

    const data = await response.json();
    return data;

  } catch (error: any) {
    console.error("GeminiService Error:", error);
    // On propage l'erreur pour qu'App.tsx puisse l'afficher correctement
    throw error;
  }
};
