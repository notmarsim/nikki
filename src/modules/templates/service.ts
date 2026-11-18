import { desc, eq, or } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { nikkiTemplates, notes, projects, tasks } from "@/db/schema";

export const BUILTIN_TEMPLATES = [
  {
    id: "builtin-software-project",
    name: "Software Development Project",
    category: "project",
    description: "Creates a project with Architecture Note and initial Backlog tasks.",
    projectTitle: "New Software Project",
    noteTitle: "Architecture & Setup",
    tasks: ["Define requirements & schema", "Implement core APIs", "Write tests & deploy"],
  },
  {
    id: "builtin-university-semester",
    name: "University Semester",
    category: "study",
    description: "Organizes semester study notes, exam prep tasks, and syllabus tracker.",
    projectTitle: "Semester 2026.2",
    noteTitle: "Syllabus & Study Plan",
    tasks: ["Organize course calendar", "Set up weekly flashcard review", "Midterm prep"],
  },
  {
    id: "builtin-weekly-planner",
    name: "Personal Weekly Planner",
    category: "productivity",
    description: "Creates a weekly review note and 3 priority execution tasks.",
    projectTitle: "Weekly Focus",
    noteTitle: "Weekly Review & Goals",
    tasks: ["Top Priority #1", "Top Priority #2", "Clear Universal Inbox"],
  },
] as const;

export async function listTemplates(userId: string) {
  return withUserRls(userId, async (tx) => {
    const custom = await tx
      .select()
      .from(nikkiTemplates)
      .where(or(eq(nikkiTemplates.authorUserId, userId), eq(nikkiTemplates.isPublic, true)))
      .orderBy(desc(nikkiTemplates.createdAt));

    return { builtin: BUILTIN_TEMPLATES, custom };
  });
}

export async function installBuiltinTemplate(
  userId: string,
  workspaceId: string,
  templateId: string
) {
  const tpl = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) throw new Error("Template not found");

  return withUserRls(userId, async (tx) => {
    const [proj] = await tx
      .insert(projects)
      .values({
        userId,
        workspaceId,
        name: tpl.projectTitle,
        description: tpl.description,
        status: "active",
      })
      .returning();

    const [note] = await tx
      .insert(notes)
      .values({
        userId,
        workspaceId,
        projectId: proj!.id,
        title: tpl.noteTitle,
        contentText: tpl.description,
        contentJson: {
          version: 1,
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: tpl.description }] }],
        },
      })
      .returning();

    for (const taskTitle of tpl.tasks) {
      await tx.insert(tasks).values({
        userId,
        workspaceId,
        projectId: proj!.id,
        title: taskTitle,
        status: "todo",
        priority: "medium",
      });
    }

    return { projectId: proj!.id, noteId: note!.id, tasksCreated: tpl.tasks.length };
  });
}
