import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, collectionsTable, paperCollectionsTable, papersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /collections — list user's collections (with paper counts + which ones contain a given paper)
router.get("/collections", async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const paperId = req.query.paperId ? parseInt(req.query.paperId as string, 10) : null;

  const collections = await db
    .select({
      id: collectionsTable.id,
      name: collectionsTable.name,
      createdAt: collectionsTable.createdAt,
      paperCount: sql<number>`(
        SELECT COUNT(*) FROM paper_collections pc WHERE pc.collection_id = ${collectionsTable.id}
      )`.mapWith(Number),
    })
    .from(collectionsTable)
    .where(eq(collectionsTable.userId, userId))
    .orderBy(collectionsTable.createdAt);

  if (paperId) {
    const memberships = await db
      .select({ collectionId: paperCollectionsTable.collectionId })
      .from(paperCollectionsTable)
      .where(eq(paperCollectionsTable.paperId, paperId));

    const memberSet = new Set(memberships.map((m) => m.collectionId));
    res.json(collections.map((c) => ({ ...c, hasPaper: memberSet.has(c.id) })));
    return;
  }

  res.json(collections.map((c) => ({ ...c, hasPaper: false })));
});

// POST /collections — create a new collection
router.post("/collections", async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const [collection] = await db
    .insert(collectionsTable)
    .values({ userId, name: name.trim() })
    .returning();

  res.status(201).json({ ...collection, paperCount: 0, hasPaper: false });
});

// DELETE /collections/:id — delete a collection
router.delete("/collections/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  const [col] = await db.select().from(collectionsTable).where(eq(collectionsTable.id, id));

  if (!col) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  if (col.userId !== userId) {
    res.status(403).json({ error: "Not authorised" });
    return;
  }

  await db.delete(collectionsTable).where(eq(collectionsTable.id, id));
  res.json({ deleted: true });
});

// POST /papers/:paperId/collections/:collectionId — add paper to collection
router.post("/papers/:paperId/collections/:collectionId", async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const paperId = parseInt(req.params.paperId, 10);
  const collectionId = parseInt(req.params.collectionId, 10);

  const [col] = await db.select().from(collectionsTable).where(
    and(eq(collectionsTable.id, collectionId), eq(collectionsTable.userId, userId))
  );
  if (!col) {
    res.status(403).json({ error: "Collection not found or not authorised" });
    return;
  }

  await db.insert(paperCollectionsTable).values({ paperId, collectionId }).onConflictDoNothing();
  res.json({ added: true });
});

// DELETE /papers/:paperId/collections/:collectionId — remove paper from collection
router.delete("/papers/:paperId/collections/:collectionId", async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const paperId = parseInt(req.params.paperId, 10);
  const collectionId = parseInt(req.params.collectionId, 10);

  const [col] = await db.select().from(collectionsTable).where(
    and(eq(collectionsTable.id, collectionId), eq(collectionsTable.userId, userId))
  );
  if (!col) {
    res.status(403).json({ error: "Not authorised" });
    return;
  }

  await db.delete(paperCollectionsTable).where(
    and(
      eq(paperCollectionsTable.paperId, paperId),
      eq(paperCollectionsTable.collectionId, collectionId)
    )
  );
  res.json({ removed: true });
});

// GET /collections/:id/papers — list papers in a collection
router.get("/collections/:id/papers", async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  const [col] = await db.select().from(collectionsTable).where(eq(collectionsTable.id, id));
  if (!col) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  if (col.userId !== userId) {
    res.status(403).json({ error: "Not authorised" });
    return;
  }

  const papers = await db
    .select({
      id: papersTable.id,
      title: papersTable.title,
      authors: papersTable.authors,
      createdAt: papersTable.createdAt,
    })
    .from(paperCollectionsTable)
    .innerJoin(papersTable, eq(papersTable.id, paperCollectionsTable.paperId))
    .where(eq(paperCollectionsTable.collectionId, id));

  res.json(papers);
});

export default router;
