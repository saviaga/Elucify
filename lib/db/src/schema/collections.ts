import { pgTable, text, serial, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { papersTable } from "./papers";

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paperCollectionsTable = pgTable("paper_collections", {
  paperId: integer("paper_id").references(() => papersTable.id, { onDelete: "cascade" }).notNull(),
  collectionId: integer("collection_id").references(() => collectionsTable.id, { onDelete: "cascade" }).notNull(),
}, (table) => [primaryKey({ columns: [table.paperId, table.collectionId] })]);

export type Collection = typeof collectionsTable.$inferSelect;
export type PaperCollection = typeof paperCollectionsTable.$inferSelect;
