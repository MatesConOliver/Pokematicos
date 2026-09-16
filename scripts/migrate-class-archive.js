/**
 * One-off, READ-ONLY migration tool.
 *
 * Reads a class from Firestore/Storage and generates a static, self-contained
 * HTML archive (with recompressed images) that can be uploaded anywhere
 * (Cloudflare Pages, Netlify, etc.). It never writes, deletes or modifies
 * anything in Firebase — deleting the original class/files is a manual,
 * separate step the teacher does later, once happy with the result.
 *
 * Usage:
 *   node scripts/migrate-class-archive.js --list
 *   node scripts/migrate-class-archive.js <classId>
 *
 * Requires scripts/serviceAccountKey.json (Firebase Console > Project
 * settings > Service accounts > Generate new private key). Never commit it.
 * 
 * in terminal, run: npm run migrate:archive -- CLASS_ID
 * output in archive-output
 * 
 */

const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const sharp = require("sharp");

const STORAGE_BUCKET = "pokematicos.firebasestorage.app";
const SERVICE_ACCOUNT_PATH =
  process.env.SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, "serviceAccountKey.json");
const OUTPUT_ROOT = path.join(__dirname, "..", "archive-output");

// Max width/quality for the recompressed archive images. Plenty for the
// small thumbnails these cards are ever displayed at.
const IMAGE_MAX_WIDTH = 900;
const IMAGE_QUALITY = 80;

// Backgrounds are shown full-screen, so they need more resolution than a card thumbnail.
const BG_MAX_WIDTH = 1600;
const BG_QUALITY = 75;

function initAdmin() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(
      `\nNo se encontró la clave de cuenta de servicio en:\n  ${SERVICE_ACCOUNT_PATH}\n` +
        `Descárgala desde Firebase Console > Project settings > Service accounts > Generate new private key,\n` +
        `y guárdala exactamente en esa ruta (o define SERVICE_ACCOUNT_PATH).\n`
    );
    process.exit(1);
  }
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: STORAGE_BUCKET,
  });
}

async function listClasses(db) {
  const snap = await db.collection("classes").get();
  if (snap.empty) {
    console.log("No hay clases en Firestore.");
    return;
  }
  console.log("\nClases disponibles:\n");
  snap.forEach((d) => {
    const data = d.data();
    console.log(`  ${d.id}  ->  ${data.name || "(sin nombre)"}`);
  });
  console.log("\nEjecuta de nuevo con: node scripts/migrate-class-archive.js <classId>\n");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Incrusta la imagen como data: URI para que el HTML sea un fichero único y
// autocontenido (no depende de rutas relativas ni de cómo se sirva/abra).
async function downloadAndCompress(url, cache, { maxWidth = IMAGE_MAX_WIDTH, quality = IMAGE_QUALITY } = {}) {
  if (!url) return "";
  if (cache.has(url)) return cache.get(url);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const compressed = await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    const dataUri = `data:image/jpeg;base64,${compressed.toString("base64")}`;
    cache.set(url, dataUri);
    return dataUri;
  } catch (err) {
    console.warn(`  ! No se pudo descargar/comprimir ${url}: ${err.message}`);
    cache.set(url, "");
    return "";
  }
}

function renderHtml({ className, students, cards, rewards, bgImg }) {
  const cardById = new Map(cards.map((c) => [c.id, c]));

  // Cada imagen se define UNA vez como regla CSS (por cardId) y se reutiliza por
  // clase en todos los sitios donde aparece esa carta, en vez de repetir el
  // base64 completo cada vez que un alumno posee esa carta.
  const imageRules = cards
    .filter((c) => c._img)
    .map((c) => `.img-${c.id} { background-image: url("${c._img}"); }`)
    .join("\n");

  function renderCardGrid(list) {
    return list
      .map(
        (c) => `
        <div class="card">
          <div class="thumb ${c._img ? `img-${c.id}` : ""}"></div>
          <div class="card-title">${escapeHtml(c.title)}</div>
          <div class="card-desc">${escapeHtml(c.description)}</div>
          <div class="card-points">${c.points || 0} pts</div>
        </div>`
      )
      .join("\n");
  }

  const CATEGORIES = [
    { key: "points", label: "Points" },
    { key: "rewards", label: "Rewards" },
    { key: "experience", label: "Experience" },
    { key: "extra", label: "Extra" },
  ];

  const libraryHtml = CATEGORIES.map(({ key, label }) => {
    const list = cards.filter((c) => (c.category || "points") === key);
    const grid = `<div class="grid">${renderCardGrid(list) || '<p class="muted">No cards.</p>'}</div>`;
    const redeemable =
      key === "rewards" && rewards.length
        ? `<ul class="redeemable-list">${rewards
            .map((r) => `<li>${escapeHtml(r.title)} — ${r.cost || 0} pts</li>`)
            .join("\n")}</ul>`
        : "";
    return `
      <div class="library-category">
        <h3>${label}</h3>
        ${grid}
        ${redeemable}
      </div>`;
  }).join("\n");

  const studentsHtml = students
    .map((s) => {
      const owned = Array.isArray(s.cards) ? s.cards : [];

      // Agrupa instancias repetidas de la misma carta en una sola entrada con contador.
      const grouped = new Map();
      for (const o of owned) {
        const key = o.cardId || o.title;
        if (!grouped.has(key)) grouped.set(key, { title: o.title, cardId: o.cardId, count: 0 });
        grouped.get(key).count += 1;
      }

      const ownedHtml = Array.from(grouped.values())
        .map(({ title, cardId, count }) => {
          const card = cardById.get(cardId);
          const hasImg = !!card?._img;
          return `
            <div class="mini-card">
              <div class="mini-thumb ${hasImg ? `img-${cardId}` : ""}"></div>
              <span>${escapeHtml(title)}${count > 1 ? ` x${count}` : ""}</span>
            </div>`;
        })
        .join("\n");

      return `
        <div class="student">
          <h3>${escapeHtml(s.name)} ${escapeHtml(s.nameEmojis || "")}</h3>
          <div class="student-stats">${s.currentPoints || 0} pts &middot; XP ${s.xp || 0}</div>
          <div class="owned-grid">${ownedHtml || '<span class="muted">No cards.</span>'}</div>
        </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Archive: ${escapeHtml(className)}</title>
<style>
  body {
    font-family: system-ui, sans-serif; margin: 0; color: #222;
    ${bgImg ? `background-image: url("${bgImg}"); background-size: cover; background-position: center; background-attachment: fixed; background-repeat: no-repeat;` : "background: #fafafa;"}
  }
  .page { max-width: 960px; margin: 0 auto; padding: 24px; ${bgImg ? "background: rgba(255,255,255,0.9); border-radius: 12px; margin-top: 24px; margin-bottom: 24px;" : ""} }
  h1 { margin-bottom: 4px; }
  .muted { color: #888; }
  section { margin: 32px 0; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .card, .student { background: white; border: 1px solid #eee; border-radius: 10px; padding: 12px; width: 160px; }
  .thumb { width: 100%; height: 200px; border-radius: 6px; background-size: cover; background-position: center; background-color: #eee; }
  .card-title { font-weight: 700; margin-top: 6px; }
  .card-points { font-weight: 700; color: #b8860b; }
  .student { width: 100%; max-width: 640px; }
  .owned-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .mini-card { display: flex; flex-direction: column; align-items: center; width: 72px; font-size: 11px; text-align: center; }
  .mini-thumb { width: 60px; height: 76px; border-radius: 6px; background-size: cover; background-position: center; background-color: #eee; }
  .library-category { margin-bottom: 24px; }
  .library-category h3 { margin-bottom: 8px; }
  .redeemable-list { margin-top: 12px; padding-left: 20px; }
  ${imageRules}
</style>
</head>
<body>
  <div class="page">
  <h1>${escapeHtml(className)}</h1>
  <p class="muted">Static archive generated on ${new Date().toLocaleDateString("en-GB")}. Frozen content, no longer interactive.</p>

  <section>
    <h2>Students</h2>
    ${studentsHtml || '<p class="muted">No students.</p>'}
  </section>

  <section>
    <h2>Library</h2>
    ${libraryHtml}
  </section>
  </div>
</body>
</html>`;
}

async function migrateClass(db, classId) {
  const classSnap = await db.doc(`classes/${classId}`).get();
  if (!classSnap.exists) {
    console.error(`No existe ninguna clase con id "${classId}".`);
    process.exit(1);
  }
  const classData = classSnap.data();
  const className = classData.name || classId;

  const [studentsSnap, cardsSnap, rewardsSnap] = await Promise.all([
    db.collection(`classes/${classId}/students`).get(),
    db.collection(`classes/${classId}/cards`).orderBy("createdAt", "asc").get(),
    db.collection(`classes/${classId}/rewards`).get(),
  ]);

  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const cards = cardsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rewards = rewardsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const outDir = path.join(OUTPUT_ROOT, classId);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\nMigrando clase "${className}" (${classId})`);
  console.log(`  ${students.length} alumnos, ${cards.length} cartas, ${rewards.length} rewards`);

  const cache = new Map();
  for (const c of cards) {
    // Preferir la imagen desbloqueada (más representativa); usar la bloqueada solo si no existe.
    const url = c.imageURL || c.lockedImageURL || "";
    c._img = await downloadAndCompress(url, cache);
  }

  const bgImg = await downloadAndCompress(classData.backgroundUrl || "", cache, {
    maxWidth: BG_MAX_WIDTH,
    quality: BG_QUALITY,
  });

  const html = renderHtml({ className, students, cards, rewards, bgImg });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

  console.log(`\nListo. Nada se ha borrado ni modificado en Firebase.`);
  console.log(`Carpeta generada en: ${outDir}`);
  console.log(`Revísala localmente (abre index.html) y, si te gusta, súbela a Cloudflare Pages.\n`);
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const arg = process.argv[2];

  if (!arg || arg === "--list") {
    await listClasses(db);
    return;
  }

  await migrateClass(db, arg);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
