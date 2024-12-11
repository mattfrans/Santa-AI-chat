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

    // Generate Santa's response
    const generateSantaResponse = (message: string) => {
      const greetings = ["Ho ho ho!", "Merry Christmas!", "Happy Holidays!"];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      
      // Simple keyword-based responses
      if (message.toLowerCase().includes("wish") || message.toLowerCase().includes("want")) {
        return `${greeting} That sounds wonderful! Have you been good this year? Make sure to add it to your wishlist!`;
      } else if (message.toLowerCase().includes("thank")) {
        return `${greeting} You're very welcome! Remember to spread joy and kindness to others!`;
      } else if (message.toLowerCase().includes("hello") || message.toLowerCase().includes("hi")) {
        return `${greeting} How wonderful to hear from you! Tell me, what makes your heart happy this Christmas?`;
      } else if (message.toLowerCase().includes("good") || message.toLowerCase().includes("nice")) {
        return `${greeting} I'm so glad to hear that! Keep up the great work, and remember that being kind to others is the best gift of all!`;
      }
      
      return `${greeting} Thank you for your message! Remember, the magic of Christmas lives in your heart!`;
    };

    const santaResponse = generateSantaResponse(message);
    
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
