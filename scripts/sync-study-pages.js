const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "4º ESO");
const targetDir = path.join(rootDir, "public", "4º ESO");

if (fs.existsSync(sourceDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      fs.copyFileSync(
        path.join(sourceDir, entry.name),
        path.join(targetDir, entry.name)
      );
    }
  }
}
