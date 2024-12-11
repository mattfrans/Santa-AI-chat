import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  isParent: boolean("is_parent").default(false).notNull(),
  parentId: integer("parent_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isFromSanta: boolean("is_from_santa").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const wishlistItems = pgTable("wishlist_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  item: text("item").notNull(),
  category: text("category").notNull(),
  priority: integer("priority").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many, one }) => ({
  children: many(users, { relationName: "parent_children" }),
  parent: one(users, {
    fields: [users.parentId],
    references: [users.id],
    relationName: "parent_children"
  }),
  chats: many(chats),
  wishlistItems: many(wishlistItems)
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
