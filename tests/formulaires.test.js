/* Contrôle des formulaires officiels de rapport (b171).
   Chaque emplacement décrit dans data/formulaires-rapports.json doit exister dans le PDF officiel :
   une coordonnée hors page ou un nom de champ mal écrit donnerait un rapport envoyé incomplet, sans message d'erreur.
   Lancé par les contrôles automatiques : node tests/formulaires.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const racine = path.join(__dirname, "..");
global.PDFLib = require(path.join(racine, "vendor/pdf-lib.min.js"));
const { remplir } = require(path.join(racine, "rt-formulaires.js"));
const { PDFDocument, PDFTextField, PDFCheckBox } = global.PDFLib;
const cartes = JSON.parse(fs.readFileSync(path.join(racine, "data/formulaires-rapports.json"), "utf8"));
const app = fs.readFileSync(path.join(racine, "app.js"), "utf8");
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const LONG = "Texte volontairement long pour vérifier le retour à la ligne, avec des accents éèàç, une apostrophe ’ et un tiret — ".repeat(3);
const uniques = (liste, quoi) => { const vus = new Set(); liste.forEach(x => { assert.ok(!vus.has(x), quoi + " en double : " + x); vus.add(x); }); };

(async () => {
  const ids = Object.keys(cartes);
  assert.deepStrictEqual(ids.sort(), ["commotion-cerebrale", "faute-disqualifiante", "incident-disciplinaire", "incident-materiel", "reclamation"]);
  let nEmplacements = 0;

  for (const id of ids) {
    const c = cartes[id], ou = id + " : ";
    assert.strictEqual(c.id, id, ou + "identifiant incohérent");
    assert.ok(app.includes('fichier: "' + c.fichier + '"'), ou + "fichier absent de la liste de l'app (" + c.fichier + ")");
    const octets = fs.readFileSync(path.join(racine, c.fichier));
    const doc = await PDFDocument.load(octets);
    const pages = doc.getPages().map(p => p.getSize());

    if (c.acroform) {
      /* Formulaire à champs : chaque nom écrit par l'app doit exister dans le PDF, avec le bon type. */
      const form = doc.getForm(), type = {};
      form.getFields().forEach(f => { type[f.getName()] = f instanceof PDFTextField ? "texte" : f instanceof PDFCheckBox ? "case" : "autre"; });
      const textes = c.texte.concat(Object.values(c.niveaux));
      const cases = Object.keys(c.niveaux).concat(c.signes, ...c.binaires.map(b => b.slice(1)));
      uniques(c.texte, ou + "champ de texte"); uniques(cases, ou + "case");
      textes.forEach(n => assert.strictEqual(type[n], "texte", ou + "champ de texte introuvable dans le PDF : « " + n + " »"));
      cases.forEach(n => assert.strictEqual(type[n], "case", ou + "case introuvable dans le PDF : « " + n + " »"));
      // les noms écrits en dur dans l'app (rfDonnees_) doivent tous être des champs de texte connus
      const bloc = app.slice(app.indexOf("function rfDonnees_"), app.indexOf("const cases = {};", app.indexOf("function rfDonnees_")));
      const enDur = [...bloc.matchAll(/"([^"]+)":\s*(?:e\.|signaturePng)/g)].map(m => m[1]);
      assert.ok(enDur.length >= 15, ou + "noms de champs de l'app introuvables (le code a changé ?)");
      enDur.forEach(n => assert.strictEqual(type[n], "texte", ou + "l'app écrit dans un champ qui n'existe pas : « " + n + " »"));
      // remplissage complet : rien ne doit rester sur le carreau
      const champs = {}; textes.forEach(n => (champs[n] = "Test " + n));
      const coches = {}; cases.forEach(n => (coches[n] = true));
      const res = await remplir(octets, c, { champs, cases: coches });
      assert.deepStrictEqual(res.restes, [], ou + "champs non remplis");
      const relu = (await PDFDocument.load(res.octets)).getForm();
      assert.strictEqual(relu.getTextField("Lieu").getText(), "Test Lieu", ou + "texte non relu");
      assert.ok(cases.every(n => relu.getCheckBox(n).isChecked()), ou + "case non cochée après remplissage");
      const oublies = Object.keys(type).filter(n => !textes.includes(n) && !cases.includes(n));
      if (oublies.length) console.log("  note — " + id + " : " + oublies.length + " champ(s) du PDF jamais rempli(s) par l'app : " + oublies.join(", "));
      nEmplacements += textes.length + cases.length;
      continue;
    }

    /* Formulaire « à plat » : chaque coordonnée doit tomber dans sa page. */
    const page = (e, quoi) => { assert.ok(Number.isInteger(e.p) && e.p >= 0 && e.p < pages.length, ou + quoi + " : page " + e.p + " inexistante (" + pages.length + " page(s))"); return pages[e.p]; };
    uniques(c.champs.map(x => x.key), ou + "champ"); uniques(c.cases.map(x => x.id), ou + "case");
    c.champs.forEach(x => {
      const P = page(x, "champ " + x.key);
      assert.ok(x.x >= 0 && x.x < x.max && x.max <= P.width + 0.5, ou + "champ " + x.key + " : largeur hors page (x " + x.x + ", max " + x.max + ", page " + P.width + ")");
      assert.ok(x.max - x.x >= 20, ou + "champ " + x.key + " : moins de 20 points de large");
      assert.ok(x.y > 15 && x.y < P.height - 15, ou + "champ " + x.key + " : hauteur hors page (y " + x.y + ")");
    });
    assert.ok(c.champs.some(x => x.key === "signature"), ou + "emplacement de signature absent");
    c.cases.forEach(x => {
      const P = page(x, "case " + x.id);
      assert.ok(x.w > 3 && x.h > 3 && x.w < 30 && x.h < 30, ou + "case " + x.id + " : taille anormale (" + x.w + " x " + x.h + ")");
      assert.ok(x.x >= 0 && x.x + x.w <= P.width && x.y >= 0 && x.y + x.h <= P.height, ou + "case " + x.id + " hors page");
    });
    // deux cases ne se recouvrent pas (sinon cocher l'une cocherait visuellement l'autre)
    c.cases.forEach((a, i) => c.cases.slice(i + 1).forEach(b => {
      const recouvre = a.p === b.p && Math.abs(a.x - b.x) < Math.min(a.w, b.w) * 0.5 && Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5;
      assert.ok(!recouvre, ou + "cases superposées : " + a.id + " et " + b.id);
    }));
    // chaque case liée à une question pointe vers une question et un choix qui existent
    const Q = {}; c.questions.forEach(q => (Q[q.id] = q));
    c.cases.filter(x => x.q).forEach(x => {
      assert.ok(Q[x.q], ou + "case " + x.id + " : question inconnue " + x.q);
      assert.ok(Q[x.q].choix.includes(x.val), ou + "case " + x.id + " : choix « " + x.val + " » absent de la question " + x.q);
    });
    c.questions.forEach(q => q.choix.forEach(ch => assert.ok(c.cases.some(x => x.q === q.id && x.val === ch), ou + "question " + q.id + " : aucune case pour le choix « " + ch + " »")));
    assert.ok(c.zones.length >= 1, ou + "aucune zone de description");
    c.zones.forEach(z => {
      const P = page(z, "zone " + z.key);
      assert.ok(z.x0 >= 0 && z.x0 < z.x1 && z.x1 <= P.width + 0.5, ou + "zone " + z.key + " : largeur hors page");
      assert.ok(z.rows.length >= 2, ou + "zone " + z.key + " : moins de 2 lignes");
      z.rows.forEach((y, i) => {
        assert.ok(y > 15 && y < P.height - 15, ou + "zone " + z.key + " : ligne " + i + " hors page (y " + y + ")");
        if (i) assert.ok(y < z.rows[i - 1] - 6, ou + "zone " + z.key + " : lignes " + (i - 1) + " et " + i + " trop proches ou dans le désordre");
      });
    });

    // remplissage complet : tous les champs, toutes les cases, une description qui déborde, une signature dessinée
    const champs = {}; c.champs.forEach(x => (champs[x.key] = x.key === "signature" ? "" : LONG));
    const coches = {}; c.cases.forEach(x => (coches[x.id] = true));
    const lignes = c.zones.reduce((t, z) => t + z.rows.length, 0);
    const res = await remplir(octets, c, { champs, cases: coches, description: ("Ligne de description numéro un. ".repeat(4) + "\n").repeat(lignes + 40), signatureImage: PNG_1PX });
    assert.deepStrictEqual(res.restes, [], ou + "éléments non écrits");
    const relu = await PDFDocument.load(res.octets);
    assert.ok(relu.getPageCount() > pages.length, ou + "la description trop longue n'a pas créé de page annexe");
    // remplissage vide : le document officiel reste intact (même nombre de pages, aucun reste)
    const vide = await remplir(octets, c, {});
    assert.deepStrictEqual(vide.restes, []);
    assert.ok(res.octets.length > vide.octets.length + 2000, ou + "rien n'a été écrit dans le PDF (le fichier rempli ne pèse pas plus que le fichier vide)");
    assert.strictEqual((await PDFDocument.load(vide.octets)).getPageCount(), pages.length, ou + "un rapport vide ne doit pas ajouter de page");
    nEmplacements += c.champs.length + c.cases.length + c.zones.reduce((t, z) => t + z.rows.length, 0);
  }
  console.log("formulaires : OK (" + ids.length + " formulaires, " + nEmplacements + " emplacements contrôlés)");
})().catch(e => { console.error("formulaires : ÉCHEC — " + String(e.message).split("\n")[0]); process.exit(1); });
