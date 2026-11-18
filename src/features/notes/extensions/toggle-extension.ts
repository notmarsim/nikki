import { mergeAttributes, Node } from "@tiptap/core";

export const ToggleExtension = Node.create({
  name: "toggleBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      summary: {
        default: "Toggle details",
        parseHTML: (el) => el.getAttribute("data-summary") ?? "Toggle details",
        renderHTML: (attrs) => ({ "data-summary": attrs.summary }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details[data-type="toggle"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        "data-type": "toggle",
        open: "true",
        class:
          "my-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-2",
      }),
      ["summary", { class: "cursor-pointer font-medium text-sm select-none" }, HTMLAttributes["data-summary"] || "Toggle details"],
      ["div", { class: "mt-2" }, 0],
    ];
  },
});
