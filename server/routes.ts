import { Express } from "express";
import { setupAuth } from "./auth";
import { db } from "../db";
import { chats, wishlistItems } from "@db/schema";
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

    // Generate Santa's response (simplified)
    const santaResponse = `Ho ho ho! Thank you for your message: "${message}"`;
    
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
