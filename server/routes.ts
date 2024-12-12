import { Express } from "express";
import { setupAuth } from "./auth";
import { db } from "../db";
import { chats, wishlistItems, users, type User } from "@db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

      // Get user's context including wishlist
      const wishlist = await db.select()
        .from(wishlistItems)
        .where(eq(wishlistItems.userId, req.user.id))
        .orderBy(wishlistItems.createdAt);

      // Build context for Santa's response
      const wishlistContext = wishlist.length > 0 
        ? `The child's wishlist contains: ${wishlist.map(item => `${item.item} (category: ${item.category})`).join(', ')}.` 
        : "The child hasn't added any items to their wishlist yet.";

      const systemPrompt = `You are Santa Claus chatting with a child. Today is December 12, 2024.
Key characteristics:
- Jolly, warm, and encouraging
- Use "Ho ho ho!" occasionally but not in every message
- Reference North Pole, elves, Mrs. Claus, reindeer, or workshop when relevant
- Keep responses brief (2-3 sentences)
- Never promise specific gifts
- Encourage good behavior and kindness
- Always maintain the magic of Christmas
- Be mindful of appropriate language and topics for children

Current context: ${wishlistContext}

Remember: Keep responses warm and friendly but avoid repetition. Engage with the child's messages naturally while maintaining Santa's character.`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          max_tokens: 150,
          temperature: 0.7,
          presence_penalty: 0.6, // Reduce repetition
          frequency_penalty: 0.6, // Encourage diversity in responses
        });

        const santaResponse = completion.choices[0]?.message?.content || 
          "Ho ho ho! The North Pole's internet connection seems a bit frosty. Let's try chatting again!";
        
        // Store Santa's response
        const [response] = await db.insert(chats).values({
          userId: req.user.id,
          message: santaResponse,
          isFromSanta: true
        }).returning();

        res.json(response);
      } catch (error: any) {
        console.error('OpenAI API Error:', error);
        // Provide a friendly fallback response
        const fallbackResponse = await db.insert(chats).values({
          userId: req.user.id,
          message: "Ho ho ho! Mrs. Claus is calling me to help with some Christmas cookies. I'll be right back to chat more!",
          isFromSanta: true
        }).returning();
        res.json(fallbackResponse);
      }
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
