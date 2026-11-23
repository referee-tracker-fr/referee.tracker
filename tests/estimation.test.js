// Test de l'estimation mois par mois (app.js, estimMoisParMois_). Données inventées. Lancer : node tests/estimation.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const estimMoisParMois_ = eval("(" + src.match(/function estimMoisParMois_\([\s\S]*?\n}\n/)[0] + ")");
const j = s => new Date(s + "T12:00:00");
// Saison passée : 2 matchs par mois de septembre à juin (20 matchs).
const passee = [];
["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].forEach(m => passee.push(j(m + "-05"), j(m + "-20")));
const faits = ["2026-09-05", "2026-09-12", "2026-09-19", "2026-10-03", "2026-10-10", "2026-10-17"].map(j);   // 6 matchs avant novembre
const a = estimMoisParMois_(faits, [j("2026-11-14")], [passee, []], 2026, new Date("2026-11-10T00:00:00"));
// rythme = (20 + 6) / (20 + 4) ; 8 mois restants à 2 matchs × rythme
assert.ok(Math.abs(a.ratio - 26 / 24) < 1e-9, "rythme");
assert.ok(Math.abs(a.total - (6 + 8 * 2 * 26 / 24)) < 1e-9, "total");
// Jouer le match déjà désigné ne change rien.
const b = estimMoisParMois_(faits.concat([j("2026-11-14")]), [], [passee, []], 2026, new Date("2026-11-15T00:00:00"));
assert.ok(Math.abs(b.total - a.total) < 1e-9, "stable quand un match désigné est joué");
// Plus de convocations que prévu dans le mois : le total monte.
const c = estimMoisParMois_(faits, ["2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"].map(j), [passee, []], 2026, new Date("2026-11-10T00:00:00"));
assert.ok(c.total > a.total + 1.5, "monte avec de nouvelles convocations");
// Rythme borné, et pas d'estimation sans saison passée suffisante.
const d = estimMoisParMois_(new Array(60).fill(j("2026-09-10")), [], [passee, []], 2026, new Date("2026-11-10T00:00:00"));
assert.strictEqual(d.ratio, 1.25);
assert.strictEqual(estimMoisParMois_(faits, [], [passee.slice(0, 10), []], 2026, new Date("2026-11-10T00:00:00")), null);
console.log("estimation : OK");
