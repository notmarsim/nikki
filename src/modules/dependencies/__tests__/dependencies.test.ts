import { describe, expect, it } from "vitest";
import { detectDependencyCycle } from "../service";

describe("detectDependencyCycle", () => {
  it("detects direct and transitive dependency cycles (A -> B -> C -> A)", () => {
    const edges = [
      { taskId: "A", dependsOnTaskId: "B" },
      { taskId: "B", dependsOnTaskId: "C" },
    ];
    expect(detectDependencyCycle(edges, "C", "A")).toBe(true);
    expect(detectDependencyCycle(edges, "A", "A")).toBe(true);
    expect(detectDependencyCycle(edges, "D", "A")).toBe(false);
  });
});
