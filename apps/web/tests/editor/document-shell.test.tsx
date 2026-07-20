// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { RfdReader } from "../../src/components/editor/rfd-reader";

describe("document shell", () => {
  it("renders committed Markdown as styled document prose", () => {
    render(<RfdReader source="Body text." />);
    expect(screen.getByText("Body text.").closest(".document-prose")).not.toBeNull();
  });
});
