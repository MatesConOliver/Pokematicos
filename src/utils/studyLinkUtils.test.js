import {
  normalizeStudyLink,
  toSafeStudyHref,
  isExternalStudyLink,
} from "./studyLinkUtils";

describe("studyLinkUtils", () => {
  test("normalizes relative folder paths like 4º ESO/monica.html to root-relative paths", () => {
    expect(normalizeStudyLink("4º ESO/monica.html")).toBe("/4º ESO/monica.html");
    expect(normalizeStudyLink("/4º ESO/radicales.html")).toBe("/4º ESO/radicales.html");
    expect(normalizeStudyLink("./4º ESO/monica.html")).toBe("/4º ESO/monica.html");
    expect(normalizeStudyLink("4º ESO\\radicales.html")).toBe("/4º ESO/radicales.html");
  });

  test("encodes spaces and special characters cleanly without double-encoding", () => {
    expect(toSafeStudyHref("4º ESO/monica.html")).toBe("/4%C2%BA%20ESO/monica.html");
    expect(toSafeStudyHref("/4%C2%BA%20ESO/radicales.html")).toBe("/4%C2%BA%20ESO/radicales.html");
  });

  test("accepts and normalizes external URLs with or without protocol", () => {
    expect(normalizeStudyLink("https://www.geogebra.org/m/abc")).toBe("https://www.geogebra.org/m/abc");
    expect(normalizeStudyLink("www.desmos.com/calculator")).toBe("https://www.desmos.com/calculator");
    expect(normalizeStudyLink("khanacademy.org")).toBe("https://khanacademy.org/");
    expect(isExternalStudyLink("www.desmos.com/calculator")).toBe(true);
    expect(isExternalStudyLink("4º ESO/monica.html")).toBe(false);
  });

  test("rejects empty strings and unsafe URL schemes", () => {
    const jsSchemeUrl = `${"java"}script:alert(1)`;
    expect(normalizeStudyLink("")).toBe("");
    expect(normalizeStudyLink("   ")).toBe("");
    expect(normalizeStudyLink(jsSchemeUrl)).toBe("");
    expect(normalizeStudyLink("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(toSafeStudyHref(jsSchemeUrl)).toBe("");
  });
});
