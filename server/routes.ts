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

    try {
      // Store user message
      await db.insert(chats).values({
        userId: req.user.id,
        message,
        isFromSanta: false
      });

      // Generate Santa's response
      let santaResponse = "";
      try {
        const OpenAI = await import('openai');
        
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("OpenAI API key is not configured");
        }
        
        const openai = new OpenAI.OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        // Get user's wishlist and chat history for context
        const wishlist = await db.select()
          .from(wishlistItems)
          .where(eq(wishlistItems.userId, req.user.id))
          .orderBy(wishlistItems.createdAt);
        
        const chatHistory = await db.select()
          .from(chats)
          .where(eq(chats.userId, req.user.id))
          .orderBy(chats.createdAt)
          .limit(5);

        const wishlistContext = wishlist.length > 0
          ? "I see you have some wonderful wishes on your list!"
          : "I'd love to hear about what you're wishing for this Christmas!";

        const conversationContext = chatHistory
          .map(chat => `${chat.isFromSanta ? 'Santa' : 'Child'}: ${chat.message}`)
          .join('\n');

        const systemPrompt = `You are Santa Claus having a cheerful conversation with a child. You must maintain a warm, jolly, and strictly family-friendly tone.

IMPORTANT RULES:
- You are Santa Claus, a kind and wise figure who promotes goodness and joy
- Always maintain a wholesome, family-friendly tone
- Use "Ho ho ho!" occasionally and reference the North Pole, elves, reindeer, and Mrs. Claus
- Never promise specific gifts or mention items from wishlists
- Focus on kindness, sharing, and the spirit of Christmas
- Keep responses positive, age-appropriate, and 2-3 sentences long
- If a child mentions anything inappropriate:
  * Do not acknowledge or repeat inappropriate content
  * Gently redirect to positive topics like helping others, being kind, or holiday traditions
  * Use phrases like "Let's talk about spreading Christmas cheer!" or "Tell me about your favorite holiday traditions!"
- Never generate responses that could be inappropriate for children

Recent conversation:
${conversationContext}

Remember: Keep the magic of Christmas alive while promoting kindness and joy!`;

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

        santaResponse = completion.choices[0].message.content || "";
      } catch (error) {
        console.error('OpenAI API Error:', error);
        
        // Family-friendly fallback responses
        const fallbackResponses = [
          "Ho ho ho! The North Pole is extra busy today! Tell me, what makes you excited about Christmas?",
          "Merry Christmas! Mrs. Claus and I were just talking about holiday traditions. Do you have any special traditions?",
          "The elves are singing carols in the workshop today! What's your favorite Christmas song?",
          "Rudolph's nose is glowing extra bright today! What's your favorite part of Christmas?"
        ];
        
        santaResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      }
      
      // Store Santa's response
      const [response] = await db.insert(chats).values({
        userId: req.user.id,
        message: santaResponse,
        isFromSanta: true
      }).returning();

      res.json(response);
    } catch (error) {
      console.error('Server Error:', error);
      res.status(500).send("An error occurred while processing your message");
    }
  });

  // Get chat history
  app.get("/api/chats", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const history = await db.select()
        .from(chats)
        .where(eq(chats.userId, req.user.id))
        .orderBy(chats.createdAt);

      res.json(history);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).send("An error occurred while fetching chat history");
    }
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

    try {
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
    } catch (error) {
      console.error('Error creating wishlist item:', error);
      res.status(500).send("An error occurred while creating the wishlist item");
    }
  });

  app.get("/api/wishlist", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const items = await db.select()
        .from(wishlistItems)
        .where(eq(wishlistItems.userId, req.user.id))
        .orderBy(wishlistItems.priority);

      res.json(items);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      res.status(500).send("An error occurred while fetching the wishlist");
    }
  });

  // Parent dashboard endpoint to get children's data
  app.get("/api/children", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.user.isParent) {
      return res.status(403).send("Only parents can access this endpoint");
    }

    try {
      const children = await db.query.users.findMany({
        where: eq(users.parentId, req.user.id),
        with: {
          chats: true,
          wishlistItems: true
        }
      });

      res.json(children);
    } catch (error) {
      console.error('Error fetching children data:', error);
      res.status(500).send("An error occurred while fetching children data");
    }
  });

  return app;
}
