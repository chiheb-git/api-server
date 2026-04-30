import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const phonesTable = pgTable("phones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  imei: text("imei").notNull().unique(),
  brand: text("brand"),
  model: text("model"),
  imageBase64: text("image_base64"),
  trustScore: real("trust_score").notNull(),
  layer1Score: real("layer1_score").notNull(),
  layer2Score: real("layer2_score").notNull(),
  layer3Result: text("layer3_result").notNull(),
  finalVerdict: text("final_verdict").notNull(),
  verificationCount: integer("verification_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPhoneSchema = createInsertSchema(phonesTable).omit({ id: true, createdAt: true });
export type InsertPhone = z.infer<typeof insertPhoneSchema>;
export type Phone = typeof phonesTable.$inferSelect;

export const searchesTable = pgTable("searches", {
  id: serial("id").primaryKey(),
  imei: text("imei").notNull(),
  searchedBy: integer("searched_by"),
  result: text("result").notNull(),
  trustScore: real("trust_score"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSearchSchema = createInsertSchema(searchesTable).omit({ id: true, createdAt: true });
export type InsertSearch = z.infer<typeof insertSearchSchema>;
export type Search = typeof searchesTable.$inferSelect;
