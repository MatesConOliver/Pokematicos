import { DEFAULT_LIBRARY_TAB, getVisibleLibraryTabs } from "./CardLibrary";

describe("CardLibrary visible tabs", () => {
  test("defaults to notices (News) tab for all modes", () => {
    expect(DEFAULT_LIBRARY_TAB).toBe("notices");
    expect(getVisibleLibraryTabs("admin")).toContain(DEFAULT_LIBRARY_TAB);
    expect(getVisibleLibraryTabs("guest")).toContain(DEFAULT_LIBRARY_TAB);
  });

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
