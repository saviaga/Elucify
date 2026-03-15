import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const papersTable = pgTable("papers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title"),
  authors: text("authors"),
  inputText: text("input_text").notNull(),
  arxivId: text("arxiv_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Paper = typeof papersTable.$inferSelect;
