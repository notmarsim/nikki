import type { NoteBlockDocument } from "@/db/schema";

export type NoteTemplateId =
  | "blank"
  | "study"
  | "tech_doc"
  | "meeting"
  | "journal"
  | "project_plan";

export interface NoteTemplate {
  id: NoteTemplateId;
  name: string;
  description: string;
  title: string;
  icon: string;
  contentJson: NoteBlockDocument;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    name: "Blank Page",
    description: "Start with a clean slate.",
    title: "Untitled",
    icon: "FileText",
    contentJson: {
      version: 1,
      type: "doc",
      content: [{ type: "paragraph" }],
    },
  },
  {
    id: "study",
    name: "Study Note",
    description: "Structured concepts, key takeaways, and review questions.",
    title: "Study Note",
    icon: "BookOpen",
    contentJson: {
      version: 1,
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Topic Overview" }] },
        { type: "paragraph", content: [{ type: "text", text: "Summarize the core concept in your own words." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key Takeaways" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Point 1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Point 2" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Review Questions" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Explain how this connects to prior knowledge" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "tech_doc",
    name: "Technical Spec",
    description: "Architecture, API contracts, and implementation notes.",
    title: "Technical Specification",
    icon: "Code2",
    contentJson: {
      version: 1,
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Context & Goals" }] },
        { type: "paragraph", content: [{ type: "text", text: "Describe the problem and non-goals." }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Architecture" }] },
        { type: "codeBlock", attrs: { language: "typescript" }, content: [{ type: "text", text: "// Example contract" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Define data model" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    description: "Agenda, discussion points, decisions, and next steps.",
    title: "Meeting Notes",
    icon: "Users",
    contentJson: {
      version: 1,
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Topic 1" }] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Decisions" }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Key decision agreed..." }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Follow up on action item" }] }] },
          ],
        },
      ],
    },
  },
  {
    id: "journal",
    name: "Daily Journal",
    description: "Intentions, reflections, and highlights of the day.",
    title: "Daily Journal",
    icon: "Sun",
    contentJson: {
      version: 1,
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Today's Focus" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Top priority" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Reflections" }] },
        { type: "paragraph", content: [{ type: "text", text: "What went well today?" }] },
      ],
    },
  },
  {
    id: "project_plan",
    name: "Project Plan",
    description: "Objectives, milestones, risks, and deliverables.",
    title: "Project Plan",
    icon: "FolderKanban",
    contentJson: {
      version: 1,
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Objective" }] },
        { type: "paragraph", content: [{ type: "text", text: "What does success look like?" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Milestones" }] },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Milestone 1" }] }] },
          ],
        },
      ],
    },
  },
];

export function getNoteTemplate(templateId?: NoteTemplateId): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === templateId) ?? NOTE_TEMPLATES[0]!;
}
