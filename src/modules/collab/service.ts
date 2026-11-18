import { and, desc, eq } from "drizzle-orm";
import * as Y from "yjs";
import { withUserRls } from "@/db/rls";
import {
  collaborativeDocuments,
  collaborativeDocumentSnapshots,
  notes,
} from "@/db/schema";
import { getMemberRole, hasRequiredRole } from "@/modules/spaces/service";

export class CollabServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function getCollabDocumentState(userId: string, noteId: string) {
  return withUserRls(userId, async (tx) => {
    const [note] = await tx
      .select({
        id: notes.id,
        userId: notes.userId,
        workspaceId: notes.workspaceId,
        contentText: notes.contentText,
      })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!note) throw new CollabServiceError(404, "NOT_FOUND", "Note not found");

    const role =
      note.userId === userId
        ? "owner"
        : await getMemberRole(userId, note.workspaceId);
    if (!role) {
      throw new CollabServiceError(403, "FORBIDDEN", "Access denied");
    }

    const [docRow] = await tx
      .select()
      .from(collaborativeDocuments)
      .where(eq(collaborativeDocuments.noteId, noteId))
      .limit(1);

    const snapshots = await tx
      .select({
        id: collaborativeDocumentSnapshots.id,
        label: collaborativeDocumentSnapshots.label,
        createdAt: collaborativeDocumentSnapshots.createdAt,
      })
      .from(collaborativeDocumentSnapshots)
      .where(eq(collaborativeDocumentSnapshots.noteId, noteId))
      .orderBy(desc(collaborativeDocumentSnapshots.createdAt))
      .limit(15);

    if (!docRow) {
      const ydoc = new Y.Doc();
      ydoc.getText("content").insert(0, note.contentText);
      const stateBase64 = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64");
      const [created] = await tx
        .insert(collaborativeDocuments)
        .values({
          noteId,
          workspaceId: note.workspaceId,
          stateBase64,
          revision: 1,
          updatedByUserId: userId,
        })
        .onConflictDoNothing()
        .returning();
      return {
        document: created ?? { noteId, stateBase64, revision: 1 },
        role,
        snapshots,
      };
    }

    return { document: docRow, role, snapshots };
  });
}

export async function applyCollabUpdate(
  userId: string,
  noteId: string,
  updateBase64: string
) {
  return withUserRls(userId, async (tx) => {
    const [note] = await tx
      .select({ id: notes.id, userId: notes.userId, workspaceId: notes.workspaceId })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);
    if (!note) throw new CollabServiceError(404, "NOT_FOUND", "Note not found");

    const role =
      note.userId === userId
        ? "owner"
        : await getMemberRole(userId, note.workspaceId);
    if (!hasRequiredRole(role, "editor")) {
      throw new CollabServiceError(403, "FORBIDDEN", "Viewer role cannot persist edits");
    }

    const [docRow] = await tx
      .select()
      .from(collaborativeDocuments)
      .where(eq(collaborativeDocuments.noteId, noteId))
      .limit(1);

    const ydoc = new Y.Doc();
    if (docRow?.stateBase64) {
      Y.applyUpdate(ydoc, Buffer.from(docRow.stateBase64, "base64"));
    }
    Y.applyUpdate(ydoc, Buffer.from(updateBase64, "base64"));

    const mergedBase64 = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64");
    const nextRevision = (docRow?.revision ?? 0) + 1;

    if (docRow) {
      await tx
        .update(collaborativeDocuments)
        .set({
          stateBase64: mergedBase64,
          revision: nextRevision,
          updatedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(collaborativeDocuments.id, docRow.id));
    } else {
      await tx.insert(collaborativeDocuments).values({
        noteId,
        workspaceId: note.workspaceId,
        stateBase64: mergedBase64,
        revision: nextRevision,
        updatedByUserId: userId,
      });
    }

    return { stateBase64: mergedBase64, revision: nextRevision };
  });
}

export async function createCollabSnapshot(
  userId: string,
  noteId: string,
  label = "Checkpoint"
) {
  return withUserRls(userId, async (tx) => {
    const [docRow] = await tx
      .select()
      .from(collaborativeDocuments)
      .where(eq(collaborativeDocuments.noteId, noteId))
      .limit(1);
    if (!docRow) {
      throw new CollabServiceError(404, "NOT_FOUND", "Collaborative state not initialized");
    }

    const ydoc = new Y.Doc();
    if (docRow.stateBase64) {
      Y.applyUpdate(ydoc, Buffer.from(docRow.stateBase64, "base64"));
    }
    const contentText = ydoc.getText("content").toString();

    const [snap] = await tx
      .insert(collaborativeDocumentSnapshots)
      .values({
        noteId,
        createdByUserId: userId,
        label,
        stateBase64: docRow.stateBase64,
        contentText,
      })
      .returning();
    return snap!;
  });
}

export async function restoreCollabSnapshot(
  userId: string,
  noteId: string,
  snapshotId: string
) {
  return withUserRls(userId, async (tx) => {
    const [snap] = await tx
      .select()
      .from(collaborativeDocumentSnapshots)
      .where(
        and(
          eq(collaborativeDocumentSnapshots.id, snapshotId),
          eq(collaborativeDocumentSnapshots.noteId, noteId)
        )
      )
      .limit(1);
    if (!snap) throw new CollabServiceError(404, "NOT_FOUND", "Snapshot not found");

    await tx
      .update(collaborativeDocuments)
      .set({
        stateBase64: snap.stateBase64,
        updatedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(collaborativeDocuments.noteId, noteId));

    return { restored: true, stateBase64: snap.stateBase64 };
  });
}
