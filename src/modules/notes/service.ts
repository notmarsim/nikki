import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { withUserRls, type DbTransaction } from "@/db/rls";
import {
  noteLinks,
  notes,
  projects,
  tasks,
  type NoteBlockDocument,
  type NoteRecord,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import type { CreateNoteInput, UpdateNoteInput } from "./schemas";
import { getNoteTemplate } from "./templates";
import {
  extractPlainText,
  extractWikiLinkIds,
  wouldCreateHierarchyCycle,
} from "./utils";

export class NoteServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function syncNoteLinksTx(
  tx: DbTransaction,
  userId: string,
  sourceNoteId: string,
  contentJson: NoteBlockDocument
): Promise<void> {
  const candidateIds = extractWikiLinkIds(contentJson).filter(
    (id) => id !== sourceNoteId
  );

  await tx
    .delete(noteLinks)
    .where(and(eq(noteLinks.userId, userId), eq(noteLinks.sourceNoteId, sourceNoteId)));

  if (candidateIds.length === 0) return;

  const ownedTargets = await tx
    .select({ id: notes.id })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        inArray(notes.id, candidateIds),
        isNull(notes.deletedAt)
      )
    );

  if (ownedTargets.length === 0) return;

  await tx.insert(noteLinks).values(
    ownedTargets.map((target) => ({
      userId,
      sourceNoteId,
      targetNoteId: target.id,
    }))
  );
}

export async function listNotes(
  userId: string,
  workspaceId: string,
  options?: { includeArchived?: boolean; projectId?: string }
): Promise<NoteRecord[]> {
  return withUserRls(userId, async (tx) => {
    const conditions = [
      eq(notes.userId, userId),
      eq(notes.workspaceId, workspaceId),
      isNull(notes.deletedAt),
    ];

    if (!options?.includeArchived) {
      conditions.push(eq(notes.isArchived, false));
    }
    if (options?.projectId) {
      conditions.push(eq(notes.projectId, options.projectId));
    }

    return tx
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.isFavorite), asc(notes.sortOrder), desc(notes.updatedAt));
  });
}

export async function getNoteDetails(userId: string, noteId: string) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    const note = rows[0];
    if (!note) {
      throw new NoteServiceError(404, "NOTE_NOT_FOUND", "Note not found");
    }

    // Breadcrumbs
    const breadcrumbs: Array<{ id: string; title: string; icon: string | null }> = [];
    let parentCursor = note.parentId;
    const seen = new Set<string>([note.id]);
    while (parentCursor && !seen.has(parentCursor)) {
      seen.add(parentCursor);
      const parentRows = await tx
        .select({
          id: notes.id,
          title: notes.title,
          icon: notes.icon,
          parentId: notes.parentId,
        })
        .from(notes)
        .where(and(eq(notes.id, parentCursor), eq(notes.userId, userId)))
        .limit(1);
      const p = parentRows[0];
      if (!p) break;
      breadcrumbs.unshift({ id: p.id, title: p.title, icon: p.icon });
      parentCursor = p.parentId;
    }

    // Backlinks (other notes pointing to this note)
    const backlinks = await tx
      .select({
        id: notes.id,
        title: notes.title,
        icon: notes.icon,
        updatedAt: notes.updatedAt,
      })
      .from(noteLinks)
      .innerJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
      .where(
        and(
          eq(noteLinks.targetNoteId, noteId),
          eq(noteLinks.userId, userId),
          isNull(notes.deletedAt)
        )
      );

    // Outgoing links
    const outgoingLinks = await tx
      .select({
        id: notes.id,
        title: notes.title,
        icon: notes.icon,
      })
      .from(noteLinks)
      .innerJoin(notes, eq(noteLinks.targetNoteId, notes.id))
      .where(
        and(
          eq(noteLinks.sourceNoteId, noteId),
          eq(noteLinks.userId, userId),
          isNull(notes.deletedAt)
        )
      );

    // Linked tasks
    const linkedTasks = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
      })
      .from(tasks)
      .where(and(eq(tasks.noteId, noteId), eq(tasks.userId, userId)));

    // Linked project
    let project: { id: string; name: string; color: string } | null = null;
    if (note.projectId) {
      const projRows = await tx
        .select({ id: projects.id, name: projects.name, color: projects.color })
        .from(projects)
        .where(and(eq(projects.id, note.projectId), eq(projects.userId, userId)))
        .limit(1);
      project = projRows[0] ?? null;
    }

    return {
      note,
      breadcrumbs,
      backlinks,
      outgoingLinks,
      linkedTasks,
      project,
    };
  });
}

export async function createNote(
  userId: string,
  workspaceId: string,
  input: CreateNoteInput
): Promise<NoteRecord> {
  const template = getNoteTemplate(input.templateId);
  const contentJson = input.contentJson ?? template.contentJson;
  const contentText = extractPlainText(contentJson);

  const created = await withUserRls(userId, async (tx) => {
    if (input.parentId) {
      const parentRows = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(
          and(
            eq(notes.id, input.parentId),
            eq(notes.userId, userId),
            isNull(notes.deletedAt)
          )
        )
        .limit(1);
      if (!parentRows[0]) {
        throw new NoteServiceError(400, "INVALID_PARENT", "Parent note not found");
      }
    }

    if (input.projectId) {
      const projRows = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
        .limit(1);
      if (!projRows[0]) {
        throw new NoteServiceError(400, "INVALID_PROJECT", "Project not found");
      }
    }

    const [inserted] = await tx
      .insert(notes)
      .values({
        userId,
        workspaceId,
        parentId: input.parentId ?? null,
        projectId: input.projectId ?? null,
        title: input.title ?? template.title,
        icon: input.icon ?? template.icon,
        contentJson,
        contentText,
      })
      .returning();

    if (!inserted) {
      throw new NoteServiceError(500, "CREATE_FAILED", "Failed to create note");
    }

    await syncNoteLinksTx(tx, userId, inserted.id, contentJson);
    return inserted;
  });

  await recordActivity({
    userId,
    workspaceId,
    entityType: "note",
    entityId: created.id,
    action: "note.created",
    payload: { title: created.title },
  });

  return created;
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<NoteRecord> {
  const updated = await withUserRls(userId, async (tx) => {
    const existingRows = await tx
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      throw new NoteServiceError(404, "NOTE_NOT_FOUND", "Note not found");
    }

    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== existing.version
    ) {
      throw new NoteServiceError(
        409,
        "VERSION_CONFLICT",
        "Note was modified elsewhere. Reloading latest version."
      );
    }

    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      if (input.parentId !== null) {
        const parentRows = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(
            and(
              eq(notes.id, input.parentId),
              eq(notes.userId, userId),
              isNull(notes.deletedAt)
            )
          )
          .limit(1);
        if (!parentRows[0]) {
          throw new NoteServiceError(400, "INVALID_PARENT", "Parent note not found");
        }
      }

      const allUserNotes = await tx
        .select({ id: notes.id, parentId: notes.parentId })
        .from(notes)
        .where(and(eq(notes.userId, userId), isNull(notes.deletedAt)));

      if (wouldCreateHierarchyCycle(allUserNotes, noteId, input.parentId)) {
        throw new NoteServiceError(
          400,
          "HIERARCHY_CYCLE",
          "Cannot move a page inside itself or one of its subpages"
        );
      }
    }

    if (input.projectId !== undefined && input.projectId !== null) {
      const projRows = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
        .limit(1);
      if (!projRows[0]) {
        throw new NoteServiceError(400, "INVALID_PROJECT", "Project not found");
      }
    }

    const nextContentJson = input.contentJson ?? existing.contentJson;
    const nextContentText =
      input.contentJson !== undefined
        ? extractPlainText(input.contentJson)
        : existing.contentText;

    const [saved] = await tx
      .update(notes)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.coverPath !== undefined ? { coverPath: input.coverPath } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.contentJson !== undefined
          ? { contentJson: nextContentJson, contentText: nextContentText }
          : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        ...(input.isArchived !== undefined
          ? {
              isArchived: input.isArchived,
              archivedAt: input.isArchived ? new Date() : null,
            }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning();

    if (!saved) {
      throw new NoteServiceError(500, "UPDATE_FAILED", "Failed to save note");
    }

    if (input.contentJson !== undefined) {
      await syncNoteLinksTx(tx, userId, noteId, nextContentJson);
    }

    return saved;
  });

  if (input.title !== undefined || input.isArchived !== undefined) {
    await recordActivity({
      userId,
      workspaceId: updated.workspaceId,
      entityType: "note",
      entityId: updated.id,
      action: input.isArchived ? "note.archived" : "note.updated",
      payload: { title: updated.title },
    });
  }

  return updated;
}

export async function duplicateNote(
  userId: string,
  workspaceId: string,
  noteId: string
): Promise<NoteRecord> {
  const details = await getNoteDetails(userId, noteId);
  return createNote(userId, workspaceId, {
    title: `${details.note.title} (Copy)`,
    icon: details.note.icon ?? "FileText",
    parentId: details.note.parentId,
    projectId: details.note.projectId,
    contentJson: details.note.contentJson,
  });
}

export async function softDeleteNote(userId: string, noteId: string): Promise<void> {
  await withUserRls(userId, async (tx) => {
    // Reparent children to the deleted note's parent so no orphan subtrees are lost
    const existingRows = await tx
      .select({ id: notes.id, parentId: notes.parentId })
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      throw new NoteServiceError(404, "NOTE_NOT_FOUND", "Note not found");
    }

    await tx
      .update(notes)
      .set({ parentId: existing.parentId, updatedAt: new Date() })
      .where(and(eq(notes.parentId, noteId), eq(notes.userId, userId)));

    await tx
      .update(notes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId), ne(notes.id, existing.parentId ?? existing.id)));
  });
}

export async function getAllNotesForLinking(userId: string, workspaceId: string) {
  return db
    .select({ id: notes.id, title: notes.title, icon: notes.icon })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.workspaceId, workspaceId),
        eq(notes.isArchived, false),
        isNull(notes.deletedAt)
      )
    )
    .orderBy(desc(notes.updatedAt));
}
