import { getVisibleLibraryTabs } from "./CardLibrary";

describe("CardLibrary visible tabs", () => {
  test("includes extra tab for admin between experience and study", () => {
    expect(getVisibleLibraryTabs("admin")).toEqual([
      "points",
      "rewards",
      "experience",
      "extra",
      "study",
      "notices",
    ]);
  });

  test("hides extra tab for non-admin users", () => {
    expect(getVisibleLibraryTabs("guest")).toEqual([
      "points",
      "rewards",
      "experience",
      "study",
      "notices",
    ]);
    expect(getVisibleLibraryTabs(undefined)).not.toContain("extra");
  });
});
