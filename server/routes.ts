import { Express } from "express";
import { setupAuth } from "./auth";
import { db } from "../db";
import { chats, wishlistItems, users } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express) {
  setupAuth(app);

  // Chat endpoints
  app.post("/api/chat", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).send("Message is required");
    }

    // Store user message
    await db.insert(chats).values({
      userId: req.user.id,
      message,
      isFromSanta: false
    });

    // Generate Santa's response using OpenAI
    const generateSantaResponse = async (message: string, userId: number) => {
      const OpenAI = require('openai');
      
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key is not configured");
      }
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      try {
        // Get user's wishlist and chat history for context
        const wishlist = await db.select()
          .from(wishlistItems)
          .where(eq(wishlistItems.userId, userId))
          .orderBy(wishlistItems.createdAt);
        
        const chatHistory = await db.select()
          .from(chats)
          .where(eq(chats.userId, userId))
          .orderBy(chats.createdAt)
          .limit(5);  // Get last 5 messages for context

        const wishlistContext = wishlist.length > 0
          ? `The child's wishlist contains: ${wishlist.map(w => w.item).join(', ')}.`
          : "The child hasn't added any items to their wishlist yet.";

        const conversationContext = chatHistory
          .map(chat => `${chat.isFromSanta ? 'Santa' : 'Child'}: ${chat.message}`)
          .join('\n');

        const systemPrompt = `You are Santa Claus having a cheerful conversation with a child. Always maintain a warm, jolly, and family-friendly tone.

IMPORTANT RULES:
- Always stay in character as Santa Claus
- Use phrases like "Ho ho ho!" occasionally
- Make references to the North Pole, elves, reindeer, and Mrs. Claus
- Never promise specific gifts
- Encourage good behavior, kindness, and the spirit of giving
- Keep responses positive and age-appropriate
- If the child mentions inappropriate content, gently redirect the conversation to appropriate Christmas topics
- Response should be 2-3 sentences maximum

Current context:
${wishlistContext}

Recent conversation:
${conversationContext}`;

        const completion = await openai.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 150,
          presence_penalty: 0.6,
          frequency_penalty: 0.5
        });

        return completion.choices[0].message.content;
      } catch (error: any) {
        console.error('OpenAI API Error:', error);
        
        if (error.message === "OpenAI API key is not configured") {
          throw error;
        }
        
        // Fallback responses for other errors
        const fallbackResponses = [
          "Ho ho ho! Santa's magic crystal ball is a bit foggy right now, but I'm still here and happy to chat! What would you like to tell me?",
          "Merry Christmas! The elves are making quite a commotion in the workshop, making it hard to hear. Could you share that with me again?",
          "Ho ho ho! Mrs. Claus just called me for some hot cocoa. I'll be right back to chat more about Christmas joy!",
          "The reindeer are practicing for Christmas Eve and making it hard to concentrate! Could you tell me again what makes you excited about Christmas?"
        ];
        
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      }
    };

    const santaResponse = await generateSantaResponse(message, req.user.id);
    
    // Store Santa's response
    const [response] = await db.insert(chats).values({
      userId: req.user.id,
      message: santaResponse,
      isFromSanta: true
    }).returning();

    res.json(response);
  });

  // Get chat history
  app.get("/api/chats", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const history = await db.select()
      .from(chats)
      .where(eq(chats.userId, req.user.id))
      .orderBy(chats.createdAt);

    res.json(history);
  });

  // Wishlist endpoints
  app.post("/api/wishlist", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const { item, category, priority, notes } = req.body;
    if (!item || !category) {
      return res.status(400).send("Item and category are required");
    }

    const [wishlistItem] = await db.insert(wishlistItems)
      .values({
        userId: req.user.id,
        item,
        category,
        priority: priority || 1,
        notes
      })
      .returning();

    res.json(wishlistItem);
  });

  app.get("/api/wishlist", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const items = await db.select()
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, req.user.id))
      .orderBy(wishlistItems.priority);

    res.json(items);
  });

  // Parent dashboard endpoint to get children's data
  app.get("/api/children", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isParent) {
      return res.status(403).send("Only parents can access this endpoint");
    }

    const children = await db.query.users.findMany({
      where: eq(users.parentId, req.user.id),
      with: {
        chats: true,
        wishlistItems: true
      }
    });

    res.json(children);
  });

  return app;
}
