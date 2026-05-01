import express, { Router } from "express";
import serverless from "serverless-http";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const router = Router();

app.use(express.json());

// Paystack Integration Endpoint
router.post("/payments/initialize", async (req: any, res: any) => {
  const { email, amount, requestId } = req.body;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({ error: "Paystack secret key not configured" });
  }

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Paystack expects amount in kobo/cents
        callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-callback`,
        metadata: {
          requestId,
        },
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Paystack initialization error:", error);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// Gemini Chat Endpoint
router.post("/chat", async (req: any, res: any) => {
  const { message, history } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key not configured" });
  }

  try {
    const genAI = new GoogleGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Inject system prompt if it's a new chat or at start
    const chat = model.startChat({
      history: history || [],
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// Map the router to /api base since we redirect /api/* to this function
app.use("/api", router);

export const handler = serverless(app);
