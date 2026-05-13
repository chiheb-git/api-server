import { pgTable, serial, text, integer, real, timestamp, bigserial, varchar } from "drizzle-orm/pg-core";
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

export const boxVerificationsTable = pgTable("box_verifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  frontImageBase64: text("front_image_base64"),
  angleImageBase64: text("angle_image_base64"),
  layer1Score: integer("layer1_score").notNull(),
  layer2Score: integer("layer2_score").notNull(),
  layer3Score: integer("layer3_score").notNull(),
  layer4Score: integer("layer4_score").notNull(),
  layer5Score: integer("layer5_score").notNull(),
  layer6Score: integer("layer6_score").notNull(),
  layer7Score: integer("layer7_score").notNull(),
  layer8Score: integer("layer8_score").notNull(),
  finalScore: integer("final_score").notNull(),
  /** TEXT : libellés longs / emojis sans risque de troncature (ex-AUTHENTIC vs chaînes fusion). */
  verdict: text("verdict").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBoxVerificationSchema = createInsertSchema(boxVerificationsTable).omit({ id: true, createdAt: true });
export type InsertBoxVerification = z.infer<typeof insertBoxVerificationSchema>;
export type BoxVerification = typeof boxVerificationsTable.$inferSelect;

export const fusionVerificationsTable = pgTable("fusion_verifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  imeiScore: integer("imei_score").notNull(),
  boxScore: integer("box_score").notNull(),
  fusionScore: integer("fusion_score").notNull(),
  verdict: text("verdict").notNull(),
  confidence: varchar("confidence", { length: 20 }).notNull(),
  agreement: varchar("agreement", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFusionVerificationSchema = createInsertSchema(fusionVerificationsTable).omit({ id: true, createdAt: true });
export type InsertFusionVerification = z.infer<typeof insertFusionVerificationSchema>;
export type FusionVerification = typeof fusionVerificationsTable.$inferSelect;
