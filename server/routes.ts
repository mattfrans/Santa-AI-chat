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
    const generateSantaResponse = async (message: string, userId: number) => {
      const greetings = [
        "Ho ho ho!",
        "Merry Christmas, my dear friend!",
        "Happy Holidays, wonderful child!",
        "Oh, what joy to hear from you!"
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      
      // Get user's wishlist for context
      const wishlist = await db.select()
        .from(wishlistItems)
        .where(eq(wishlistItems.userId, userId))
        .orderBy(wishlistItems.createdAt);

      const messageL = message.toLowerCase();
      
      // Context-aware responses
      if (messageL.includes("wish") || messageL.includes("want") || messageL.includes("present")) {
        if (wishlist.length > 0) {
          const recentItem = wishlist[wishlist.length - 1];
          return `${greeting} I see you've added ${recentItem.item} to your wishlist! That's wonderful! My elves are working very hard in their workshop. Have you been good this year?`;
        }
        return `${greeting} What a lovely thought! Make sure to add your wishes to your special wishlist. My elves check it every day!`;
      } 
      
      if (messageL.includes("thank")) {
        return `${greeting} You're very welcome, dear child! Your kindness warms my heart more than a cup of Mrs. Claus's hot cocoa! Remember to spread that wonderful Christmas spirit to everyone you meet!`;
      } 
      
      if (messageL.includes("hello") || messageL.includes("hi")) {
        if (wishlist.length > 0) {
          return `${greeting} How delightful to hear from you! I've been reading your wishlist with great interest. The elves are especially excited about making toys this year!`;
        }
        return `${greeting} How wonderful to hear from you! Tell me, what makes your heart happy this Christmas season?`;
      } 
      
      if (messageL.includes("good") || messageL.includes("nice")) {
        return `${greeting} That's exactly what I love to hear! My elves have been telling me wonderful things about you. Keep spreading joy and kindness - they're the true magic of Christmas!`;
      }
      
      if (messageL.includes("cookie") || messageL.includes("milk")) {
        return `${greeting} Oh, how thoughtful of you to mention cookies! Mrs. Claus just baked a fresh batch at the North Pole. Don't forget to leave some out on Christmas Eve - they're my favorite part of the journey!`;
      }
      
      if (messageL.includes("reindeer") || messageL.includes("rudolph")) {
        return `${greeting} Ah, the reindeer are doing splendidly! Rudolph's nose is glowing brighter than ever, and they're all practicing their takeoffs and landings for the big night!`;
      }
      
      if (messageL.includes("elf") || messageL.includes("elves")) {
        return `${greeting} My elves are bustling about the workshop, spreading Christmas cheer and crafting presents with love. They send their jolly greetings to you!`;
      }
      
      return `${greeting} Your message brings warmth to my heart! Remember, the magic of Christmas lives in every kind deed and happy smile. Is there anything special you'd like to tell Santa about?`;
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
