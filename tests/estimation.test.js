// Test de l'estimation de fin de saison (app.js). Données inventées. Lancer : node tests/estimation.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const fn = nom => eval("(" + src.match(new RegExp("function " + nom + "\\([\\s\\S]*?\\n}\\n"))[0] + ")");
eval(src.match(/const ESTIM_PARTS_TYPE_ = [^\n]*\n/)[0].replace("const ", "var "));
eval(src.match(/const ESTIM_MIN_MATCHS_ = [^\n]*\n/)[0].replace("const ", "var "));
const estimMoisParMois_ = fn("estimMoisParMois_"), estimProfilType_ = fn("estimProfilType_"), estimVerrou_ = fn("estimVerrou_");
const j = s => new Date(s + "T12:00:00"), proche = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, m + " : " + a + " ≠ " + b);
const G = ESTIM_PARTS_TYPE_;
proche(G.reduce((x, y) => x + y, 0), 1, "les parts type font 100 %");

// --- Arbitre AVEC saison passée : 3 matchs par mois de septembre à juin (30 matchs) ---
const passee = [];
["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].forEach(m => passee.push(j(m + "-05"), j(m + "-15"), j(m + "-25")));
// Part du mois = forme personnelle (10 % par mois, 30 matchs) mêlée à la répartition type (poids de 50 matchs), × 30 matchs.
const base = G.map((g, i) => (30 * (i >= 1 && i <= 10 ? 0.1 : 0) + 50 * g) / 80 * 30);
const faits = ["2026-09-05", "2026-09-12", "2026-09-19", "2026-10-03", "2026-10-10", "2026-10-17"].map(j);   // 6 matchs avant novembre
const auj = new Date("2026-11-10T00:00:00");
const a = estimMoisParMois_(faits, [j("2026-11-14")], [passee, []], 2026, auj);
const rythme = (20 + 6) / (20 + base[0] + base[1] + base[2]);
proche(a.ratio, rythme, "rythme");
proche(a.total, 6 + base.slice(3).reduce((t, b) => t + Math.max(0, rythme * b), 0), "total");
assert.strictEqual(a.marge, 0.22, "marge d'octobre à décembre");
// Jouer le match déjà désigné ne change rien.
const b = estimMoisParMois_(faits.concat([j("2026-11-14")]), [], [passee, []], 2026, new Date("2026-11-15T00:00:00"));
proche(b.total, a.total, "stable quand un match désigné est joué");
// Mois en cours au-dessus de l'attendu : le total monte et le surplus compte tout de suite dans le rythme.
const c = estimMoisParMois_(faits, ["2026-11-07", "2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22", "2026-11-28"].map(j), [passee, []], 2026, auj);
proche(c.ratio, (20 + 6 + 6) / (20 + base[0] + base[1] + base[2] + base[3]), "surplus du mois en cours");
assert.ok(c.total > a.total + 1.5, "monte avec de nouvelles convocations");
// Rythme borné ; pas de modèle personnel sous 25 matchs la saison passée.
assert.strictEqual(estimMoisParMois_(new Array(60).fill(j("2026-09-10")), [], [passee, []], 2026, auj).ratio, 1.25);
assert.strictEqual(estimMoisParMois_(faits, [], [passee.slice(0, 24), []], 2026, auj), null);

// --- Arbitre SANS saison passée : répartition type ---
// Inscrit en novembre, 2 matchs joués et 2 désignés : niveau a priori de 35 matchs, aucun mois complet.
const nov = ["2026-11-07", "2026-11-14"].map(j), des = ["2026-11-21", "2026-11-28"].map(j);
const s1 = estimProfilType_(nov, des, 2026, new Date("2026-11-20T00:00:00"));
proche(s1.niveau, 35, "niveau a priori"); proche(s1.total, 35 * 0.834, "sans historique : total");
assert.strictEqual(s1.moisComplets, 0);
proche(estimProfilType_(nov.concat([des[0]]), [des[1]], 2026, new Date("2026-11-22T00:00:00")).total, s1.total, "sans historique : stable quand un match désigné est joué");
// Deux mois terminés à 6 matchs chacun : le niveau est corrigé, et il y a 2 mois complets.
const s3 = estimProfilType_(["2026-10-03", "2026-10-04", "2026-10-10", "2026-10-11", "2026-10-17", "2026-10-18", "2026-11-07", "2026-11-08", "2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"].map(j), [], 2026, new Date("2026-12-02T00:00:00"));
proche(s3.niveau, (15 + 12) / (15 / 35 + 0.103 + 0.126), "niveau corrigé par les mois terminés");
assert.strictEqual(s3.moisComplets, 2); assert.strictEqual(s3.marge, 0.22);

// --- Verrou « pas assez de données » : 8 matchs connus ET un mois complet, sauf saison passée suffisante ---
const t = new Date("2026-11-20T00:00:00");
assert.strictEqual(estimVerrou_(true, 0, 0, t), null, "avec saison passée : jamais verrouillé");
assert.strictEqual(estimVerrou_(false, 8, 1, t), null, "8 matchs et un mois complet : affiché");
assert.deepStrictEqual([estimVerrou_(false, 7, 3, t).nb, estimVerrou_(false, 7, 3, t).moisOk], [7, true], "7 matchs : verrouillé");
const v = estimVerrou_(false, 12, 0, t);
assert.ok(v && !v.moisOk && v.le.getMonth() === 11 && v.le.getDate() === 1, "pas de mois complet : verrouillé jusqu'au 1er du mois suivant");
console.log("estimation : OK");
