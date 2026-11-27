// Test du rapprochement « J'ai reçu un virement » et de l'historique annulable (app.js, b181). Lancer : node tests/virement.test.js
// Cas réel du 25/11/2026 (montants de l'app) : virement de la Ligue, 7 matchs prévus par son calendrier.
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
// une fonction = de « function nom( » jusqu'à la fonction suivante (certaines tiennent sur une ligne)
const bloc = nom => { const i = src.indexOf("\nfunction " + nom + "("); assert.ok(i >= 0, nom + " introuvable"); return src.slice(i, src.indexOf("\nfunction ", i + 1)); };
const fn = nom => eval("(" + bloc(nom).trim().replace(/\n(const|let|\/\*|\/\/)[\s\S]*$/, "") + ")");
const get = (r, k) => r[k] ?? "", toNumber = v => Number(String(v).replace(",", ".")) || 0, cleanText = s => String(s || "");
const parseFrDate = fn("parseFrDate"), rbFmtDate_ = d => d.toLocaleDateString("fr-FR"), rbClasse_ = r => r._cls || "ligue", Profil = {};
const VIR_PAYEURS_ = { cd: "Comité départemental", ligue: "Ligue régionale", ffbb: "FFBB" };
const virDejaRecu_ = fn("virDejaRecu_"), virDuC_ = fn("virDuC_"), virCandidats_ = fn("virCandidats_"), virTaux_ = fn("virTaux_"), virEstime_ = fn("virEstime_"),
  virLieu_ = fn("virLieu_"), virExplique_ = fn("virExplique_"), virSelection_ = fn("virSelection_"), virChercher_ = fn("virChercher_"), virGroupes_ = fn("virGroupes_"), virParts_ = fn("virParts_");
const M = [["1504", "2026-10-03", "PNF", 69, "25/11/2026"], ["2010", "2026-10-03", "RM2", 69, "25/11/2026"], ["2533", "2026-10-10", "RF2", 62.6, "25/11/2026"], ["2050", "2026-10-17", "RM2", 61.8, "25/11/2026"],
  ["181111", "2026-10-21", "CPE", 84.2, "25/11/2026"], ["1529", "2026-11-07", "PNF", 53, "25/11/2026"], ["1535", "2026-11-14", "PNF", 49, "25/11/2026"],
  ["2106", "2026-11-21", "RM2", 61.8, "11/01/2027"], ["21034", "2026-11-22", "RMU21", 61.8, "11/01/2027"]];
var state = { allRows: M.map(([u, d, c, t, a]) => ({ UID: u, "Code compétition": c, "Indemnité totale": t, "Statut paiement": "À recevoir", "Date attendue": a, _isActive: true, _format: "5x5", _date: new Date(d + "T12:00:00"), _reste: t })) };
const jour = new Date("2026-11-25T23:59:59"), cands = virCandidats_("ligue", jour);
const choix = m => [...virSelection_(cands, m, jour).sel].sort();
const prevus = ["1504", "1529", "1535", "181111", "2010", "2050", "2533"];
assert.deepStrictEqual(choix(448.6), prevus, "total exact : les 7 matchs prévus");
assert.deepStrictEqual(choix(378.8), prevus, "pas de total exact : les matchs prévus, jamais le RM2 du 21/11 payable en janvier");
assert.ok(!choix(123.6).includes("2106"), "jamais un match pas encore dû quand le payeur a annoncé ses matchs");
assert.deepStrictEqual(choix(130.6), [], "montant trop loin des matchs prévus : rien de coché");
assert.deepStrictEqual(choix(69), ["1504"], "un seul match");
// Virement réel reçu le 25/11 : 440,60 € (8 € de moins que les 7 convocations). Les 7 bons matchs, jamais ceux payables en janvier.
assert.deepStrictEqual(choix(440.6), prevus, "440,60 € : les 7 matchs prévus (la version b177 prenait le RM2 du 21/11 et le RMU21 du 22/11)");
{ const sel = cands.filter(r => prevus.includes(r.UID)), uids = sel.map(r => r.UID), du = new Map(sel.map(r => [r.UID, virDuC_(r)]));
  const somme = p => p.reduce((a, b) => a + b, 0);
  const choisi = virParts_(uids, du, 44060, "181111");
  assert.strictEqual(somme(choisi), 44060, "la somme des parts = le virement");
  assert.strictEqual(choisi[uids.indexOf("181111")], 8420 - 800, "l'écart va sur le match désigné");
  assert.ok(uids.filter(u => u !== "181111").every(u => choisi[uids.indexOf(u)] === du.get(u)), "les autres reçoivent leur dû");
  const inconnu = virParts_(uids, du, 44060, "");
  assert.strictEqual(somme(inconnu), 44060, "sans choix : la somme reste exacte");
  assert.strictEqual(somme(virParts_(uids, du, 44060, "1535")), 44060);
  assert.strictEqual(virParts_(["1535"], new Map([["1535", 4900]]), 4000, "1535")[0], 4000, "écart plus petit que le dû : ok");
  assert.strictEqual(somme(virParts_(uids, du, 10000, "1535")), 10000, "écart plus grand que le dû du match choisi : règle d'avant, somme exacte"); }

// Historique : un virement = payeur + date ; montant total ; le plus récent d'abord
const recu = (uid, montant, date) => Object.assign(state.allRows.find(r => r.UID === uid), { "Statut paiement": "Reçu", "Reçu recevant": montant, "Mode recevant": "Virement", "Date reçu recevant": date });
["1504", "2050", "181111", "1529", "1535", "2106"].forEach(u => recu(u, state.allRows.find(r => r.UID === u)["Indemnité totale"], "25/11/2026"));
recu("2533", 62.6, "2026-10-30");
const G = virGroupes_();
assert.strictEqual(G.length, 2);
assert.strictEqual(G[0].date, "25/11/2026"); assert.strictEqual(G[0].total, 37880); assert.strictEqual(G[0].matchs.length, 6);
assert.strictEqual(G[1].date, "30/10/2026", "date au format AAAA-MM-JJ lue aussi");
state.allRows.find(r => r.UID === "2533")["Mode recevant"] = "Espèces";
assert.strictEqual(virGroupes_().length, 1, "un paiement en espèces n'est pas un virement");
console.log("virement : OK (rapprochement sur le cas réel du 25/11, historique)");
