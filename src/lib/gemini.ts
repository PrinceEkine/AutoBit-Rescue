import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("TODO")) {
    throw new Error("Gemini API Key is missing. Please add it to your project secrets.");
  }
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function getChatResponse(message: string, history: any[]) {
  const ai = getGenAI();
  const model = (ai as any).getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const chat = model.startChat({
    history: history,
    generationConfig: {
      maxOutputTokens: 500,
    },
  });

  const result = await chat.sendMessage(message);
  const response = await result.response;
  return response.text();
}

export const SYSTEM_PROMPT = `You are the AutoDispatch AI Assistant. 
Your job is to help customers with car maintenance and emergency breakdown requests.
Be helpful, professional, and concise.
If a customer is in an emergency, advise them to click the "Request Help Now" button immediately.
You can answer questions about common car issues, estimated costs, and how our service works.
Do not provide medical or legal advice.`;
