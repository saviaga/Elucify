import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { papersTable } from "./papers";

export const paperSectionsTable = pgTable("paper_sections", {
  id: serial("id").primaryKey(),
  paperId: integer("paper_id").notNull().references(() => papersTable.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaperSection = typeof paperSectionsTable.$inferSelect;
