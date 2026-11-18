import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModulePlaceholder } from "../module-placeholder";

describe("ModulePlaceholder", () => {
  it("renders honest development status and planned features for a Phase 2 module", () => {
    const { getByText } = render(<ModulePlaceholder moduleId="notes" />);

    expect(getByText("Notes")).toBeInTheDocument();
    expect(getByText(/Phase 2 — In Development/i)).toBeInTheDocument();
    expect(getByText(/Back to Dashboard/i)).toBeInTheDocument();
  });

  it("renders nothing for unknown module ids", () => {
    const { container } = render(<ModulePlaceholder moduleId="non-existent" />);
    expect(container.firstChild).toBeNull();
  });
});
