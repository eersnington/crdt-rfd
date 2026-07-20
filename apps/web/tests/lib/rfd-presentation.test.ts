import { describe, expect, it } from "vite-plus/test";

import { parseRfdStatus, statusLabels } from "../../src/lib/rfd-presentation";

describe("parseRfdStatus", () => {
  it("keeps valid statuses", () => {
    expect(parseRfdStatus("discussion")).toBe("discussion");
    expect(parseRfdStatus("accepted")).toBe("accepted");
  });

  it("falls back to draft for invalid values", () => {
    expect(parseRfdStatus(undefined)).toBe("draft");
    expect(parseRfdStatus("nope")).toBe("draft");
  });

  it("has labels for every status", () => {
    expect(statusLabels.draft).toBe("Draft");
    expect(statusLabels.superseded).toBe("Superseded");
  });
});
