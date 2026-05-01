
export async function getChatResponse(message: string, history: any[]) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get AI response");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw error;
  }
}

export const SYSTEM_PROMPT = `You are the AutoDispatch AI Assistant. 
Your job is to help customers with car maintenance and emergency breakdown requests.
Be helpful, professional, and concise.
If a customer is in an emergency, advise them to click the "Request Help Now" button immediately.
You can answer questions about common car issues, estimated costs, and how our service works.
Do not provide medical or legal advice.`;
