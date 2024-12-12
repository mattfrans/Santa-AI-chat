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

      // Generate Santa's response using rule-based system
      const getChristmasContext = async (userId: number) => {
        const wishlist = await db.select()
          .from(wishlistItems)
          .where(eq(wishlistItems.userId, userId))
          .orderBy(wishlistItems.createdAt);
        
        return wishlist.length > 0;
      };

      const generateSantaResponse = async (message: string, hasWishlist: boolean) => {
        message = message.toLowerCase();
        
        // Responses for different contexts
        const responses = {
          greeting: [
            "Ho ho ho! Merry Christmas, my dear friend! How are you enjoying the holiday season?",
            "Ho ho ho! What a joy to hear from you! The elves and I were just wrapping presents!",
            "Merry Christmas! Mrs. Claus just baked some cookies while I was reading your message!"
          ],
          presents: [
            "The spirit of giving is what makes Christmas magical! Have you thought about what you might give to others?",
            "Ho ho ho! Remember, the best presents are the ones given with love and kindness!",
            "The elves are working very hard in the workshop! Tell me, what makes Christmas special for you?"
          ],
          activities: [
            "The reindeer love playing in the snow! What's your favorite winter activity?",
            "Ho ho ho! The elves are decorating the workshop! Do you help decorate for Christmas?",
            "Mrs. Claus and I love singing carols together! What's your favorite Christmas song?"
          ],
          default: [
            "Ho ho ho! The magic of Christmas is in the joy we share! What makes you smile during the holidays?",
            "The North Pole is extra sparkly today! Tell me about your favorite holiday traditions!",
            "Rudolph and the other reindeer send their jolly greetings! What's your favorite part of Christmas?"
          ]
        };

        // Select response category based on message content
        let category = 'default';
        if (message.match(/hi|hello|hey|greetings/)) {
          category = 'greeting';
        } else if (message.match(/present|gift|want|wish|toy/)) {
          category = 'presents';
        } else if (message.match(/play|game|song|carol|snow|decoration/)) {
          category = 'activities';
        }

        const categoryResponses = responses[category];
        return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
      };

      const hasWishlist = await getChristmasContext(req.user.id);
      const santaResponse = await generateSantaResponse(message, hasWishlist);
      
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
