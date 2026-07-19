// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { RfdReader } from "../../src/components/editor/rfd-reader";

describe("document shell", () => {
  it("renders committed Markdown as styled document prose", () => {
    render(<RfdReader source={"# Test title\n\nBody text."} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Test title");
    expect(heading.closest(".document-prose")).not.toBeNull();
    expect(screen.getByText("Body text.").closest(".document-prose")).not.toBeNull();
  });
});
