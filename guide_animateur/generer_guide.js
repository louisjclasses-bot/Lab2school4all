// Guide animateur : capture le premier écran de chaque exercice adapté (FR, EN, IT)
// puis génère un PDF A4 avec une page par exercice, une bande par langue,
// exercice adapté à gauche et exercice d'origine à droite.
//
// Usage (depuis la racine du dépôt) :
//   node guide_animateur/generer_guide.js            captures + PDF
//   node guide_animateur/generer_guide.js --pdf      PDF seul (captures existantes)
// Nécessite Playwright (Chromium) et Python 3 avec Pillow (recadrage des captures).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const RACINE = path.resolve(__dirname, '..');
const CAPTURES = path.join(__dirname, 'captures');
const ORIGINAUX = path.join(RACINE, 'images', 'originaux');
const PDF = path.join(__dirname, 'guide_animateur.pdf');

// num : numéro de l'exercice dans le manuel (badge vert de l'image d'origine).
// Fichiers repris du questionnaire Qualtrics. code : nom de l'image d'origine et de la capture ; fichier : exercice adapté (FR, puis _EN et _IT).
const EXERCICES = [
  { num: 1, code: 'GroupeEchange', fichier: 'GroupeEchange', titre: 'Ranger des nombres dans l\'ordre' },
  { num: 2, code: 'Comptage', fichier: 'Comptage', titre: 'Compter des objets' },
  { num: 3, code: 'EcritureNombres', fichier: 'EcritureNombres', titre: 'Écrire des nombres en chiffres' },
  { num: 4, code: 'CM_Math', fichier: 'CM_Math', titre: 'Comparer des nombres' },
  { num: 5, code: 'Decomposition', fichier: 'Decomposition', titre: 'Décomposer un nombre' },
  { num: 6, code: 'AdditionsPosees', fichier: 'AdditionsPosees', titre: 'Additions posées' },
  { num: 7, code: 'Classe', fichier: 'Classe', titre: 'Classer des mots par couleur' },
  { num: 8, code: 'CocheGroupeMots', fichier: 'CocheGroupeMots', titre: 'Cliquer sur des groupes de mots' },
  { num: 9, code: 'Associe', fichier: 'associe_colonne_noms', titre: 'Associer des noms' },
  { num: 10, code: 'CliqueEcrire', fichier: 'CliqueEcrire_1', titre: 'Repérer des mots dans un texte' },
  { num: 11, code: 'CochePhrase', fichier: 'CochePhrase', titre: 'Cliquer sur des phrases' },
  { num: 12, code: 'RC', fichier: 'RC', titre: 'Compléter une phrase' },
  { num: 13, code: 'CacheIntrus', fichier: 'CacheIntrus', titre: "Cacher l'intrus" },
  { num: 14, code: 'EditPhrase', fichier: 'EditPhrase', titre: 'Corriger une phrase' },
  { num: 15, code: 'TransformeMot', fichier: 'TransformeMot', titre: 'Transformer un mot' },
  { num: 16, code: 'RCDouble', fichier: 'RCDouble', titre: 'Remplacer un mot par son contraire' },
];
// Ordre des pages du PDF : ordre du manuel, par numéro d'exercice (le 10, CliqueEcrire, est retiré).
const ORDRE = [12, 15, 3, 5, 4, 9, 8, 13, 7, 11, 2, 16, 14, 1, 6];
const PAGES = ORDRE.map(n => EXERCICES.find(ex => ex.num === n));
const LANGUES = [['FR', 'Français', ''], ['EN', 'English', '_EN'], ['IT', 'Italiano', '_IT']];
const url = p => 'file://' + p.split(path.sep).map(encodeURIComponent).join('/');

async function capturer(navigateur) {
  const page = await navigateur.newPage({ viewport: { width: 860, height: 760 }, deviceScaleFactor: 2 });
  for (const [langue, , suffixe] of LANGUES) {
    fs.mkdirSync(path.join(CAPTURES, langue), { recursive: true });
    for (const ex of EXERCICES) {
      const sortie = path.join(CAPTURES, langue, ex.code + '.png');
      await page.goto(url(path.join(RACINE, ex.fichier + suffixe + '.html')));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: sortie, fullPage: true });
      execFileSync('python3', ['-I', path.join(__dirname, 'recadrer.py'), sortie]);
      console.log(sortie);
    }
  }
  await page.close();
}

function html() {
  const pages = PAGES.map(ex => `
<section class="page">
  <header><span class="num">Ex. ${ex.num}</span><h1>${ex.titre}<code>${ex.code}</code></h1></header>
  <div class="cols"><div>Exercice adapté · Adapted · Adattato</div><div>Exercice d'origine · Original · Originale</div></div>
  ${LANGUES.map(([l, nom]) => `
  <div class="band">
    <div class="lang"><b>${l}</b><span>${nom}</span></div>
    <div class="cell"><img src="${url(path.join(CAPTURES, l, ex.code + '.png'))}"></div>
    <div class="cell orig"><img src="${url(path.join(ORIGINAUX, l, ex.code + '.png'))}"></div>
  </div>`).join('')}
  <footer>Lab2School4All · Guide animateur</footer>
</section>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Guide animateur</title><style>
@page { size: A4 portrait; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; color: #1d2a36 }
.page { width: 210mm; height: 297mm; padding: 9mm 9mm 8mm; display: flex; flex-direction: column; page-break-after: always }
header { display: flex; align-items: baseline; gap: 4mm; border-bottom: 1.2pt solid #1d2a36; padding-bottom: 2mm }
header h1 { font-size: 17pt; margin: 0; flex: 1; white-space: nowrap }
header h1 code { font: 10pt monospace; color: #6b7785; margin-left: 3mm; background: #eef1f4; padding: .5mm 1.5mm; border-radius: 1mm }
.num { font-size: 10pt; font-weight: bold; background: #1d2a36; color: #fff; padding: .6mm 2mm; border-radius: 1mm }
footer { font-size: 7.5pt; color: #6b7785; text-align: right; padding-top: 1.5mm }
.cols { display: grid; grid-template-columns: 9mm 1fr 1fr; gap: 3mm; font-size: 8pt; font-weight: bold; color: #6b7785; text-transform: uppercase; letter-spacing: .3pt; margin: 2.5mm 0 1.5mm }
.cols div:first-child { grid-column: 2 }
.band { flex: 1; display: grid; grid-template-columns: 9mm 1fr 1fr; gap: 3mm; padding: 3mm 0; border-bottom: .6pt dashed #b9c2cc; min-height: 0 }
.band:last-child { border-bottom: 0 }
.lang { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #eef1f4; border-radius: 1.5mm; writing-mode: vertical-rl; transform: rotate(180deg); gap: 1.5mm }
.lang b { font-size: 12pt; letter-spacing: 1pt }
.lang span { font-size: 7.5pt; color: #6b7785 }
.cell { border: .6pt solid #c9d1d9; border-radius: 1.5mm; padding: 2mm; display: flex; align-items: center; justify-content: center; min-height: 0; overflow: hidden }
.cell.orig { background: #fbfaf6 }
.cell img { max-width: 100%; max-height: 100%; object-fit: contain }
</style></head><body>${pages}</body></html>`;
}

(async () => {
  const navigateur = await chromium.launch();
  if (!process.argv.includes('--pdf')) await capturer(navigateur);
  const fichierHtml = path.join(CAPTURES, '..', '.guide_animateur.html');
  fs.writeFileSync(fichierHtml, html());
  const page = await navigateur.newPage();
  await page.goto(url(fichierHtml));
  await page.waitForLoadState('networkidle');
  await page.pdf({ path: PDF, printBackground: true, preferCSSPageSize: true });
  fs.unlinkSync(fichierHtml);
  await navigateur.close();
  console.log(PDF);
})();
