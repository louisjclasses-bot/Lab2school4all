# Lab2School4All : contexte pour Claude

Ce dépôt héberge les exercices et les fichiers du questionnaire Qualtrics **Lab2School4All**. L'étude recueille l'avis de parents, d'enseignants, de professionnels de santé et de jeunes adultes dyspraxiques sur des exercices de manuels scolaires adaptés pour les enfants dyspraxiques (TDC / DCD). Le projet est financé par l'Union européenne (Horizon Europe). L'avis éthique a été donné par l'University of Limerick.

## Préférences et contraintes de l'utilisatrice / l'utilisateur

- **Langue :** échanger en français. Les fichiers destinés aux participants sont en français, anglais ou italien selon la branche.
- **Ne jamais utiliser le tiret long** (tiret cadratin, U+2014), ni dans les réponses ni dans les fichiers produits.
- **Quand la demande est « juste échanger » ou « ne génère rien »**, analyser et répondre, sans créer ni modifier de fichier.
- **Qualtrics :**
  - l'abonnement ne permet pas le JavaScript dans les questions : seuls le HTML des questions et le CSS général sont utilisables ;
  - l'utilisateur travaille sur un questionnaire partagé par le titulaire de la licence, avec un compte gratuit, et la bibliothèque Qualtrics est pénible à utiliser : héberger les images et les pages sur GitHub Pages plutôt que dans Qualtrics.
- **Accessibilité :** au moins un quart des participants sont dyspraxiques.
  - Ne jamais réduire la taille du texte des exercices : pas de zoom arrière ni de `transform: scale`.
  - L'interligne des exercices fait partie de ce qui est évalué : ne pas le modifier.
- **Fichiers d'exercices existants :** ne pas les modifier quand une variante est demandée. Dupliquer et suffixer (par exemple `_2`).
- **Comparabilité :** tout changement d'un exercice ou d'une image doit être appliqué de la même façon en FR, EN et IT.

## Dépôt et publication

- **Publication :** GitHub Pages publie la branche `main` à l'adresse https://louisjclasses-bot.github.io/Lab2school4all/
- **Un fichier n'est visible en ligne qu'après fusion sur `main`.** Travailler sur la branche de session, puis ouvrir une demande de fusion (pull request) quand l'utilisateur le demande.
- Les demandes de fusion n°9 et n°10 ont déjà été fusionnées. Pour la suite, repartir de `main` à jour.

### Arborescence

| Élément | Contenu |
|---|---|
| `*.html` à la racine | Les exercices. Version française sans suffixe, `_EN` (Irlande et Royaume-Uni), `_IT` (Italie). |
| `communs/` | CSS et JS partagés par les exercices « classiques » (maths). Ne pas modifier : touche tous les exercices de maths. |
| `consignes/` | Pages de consigne intégrées en iframe : `consigne_exercices_{FR,EN,IT}.html`, `consigne_comparaison_{FR,EN,IT}.html`. |
| `demos/` | GIF animés des consignes. |
| `images/originaux/{FR,EN,IT}/` | Captures des 16 exercices d'origine, découpées dans les cahiers d'exercices PDF. |
| `images/comparaisons/{FR,EN,IT}/` | Captures des 7 versions comparées. |
| `consent-form-tricolore.html`, `_FR`, `_IT` | Formulaires de consentement, en iframe dans l'introduction. |
| `fiche_information_FR.html` | Notice d'information (FR). EN : fichier Qualtrics de Limerick. IT : n'existe pas encore. |
| `qualtrics/Lab2School4All_6.qsf` | Export Qualtrics complet, à importer. |
| `qualtrics/style_general.css` | CSS général de Qualtrics (à coller dans *Look & Feel > Style > CSS personnalisé*). |
| `qualtrics/RESUME_questionnaire.md` | Résumé lisible du questionnaire pour l'équipe. |

## Les exercices HTML : deux moteurs

### 1. Moteur « Malin » (Vue, fichier unique)

Exercices concernés : RC, TransformeMot, CocheGroupeMots, CochePhrase, CacheIntrus, EditPhrase, Classe, associe_*, RCDouble, CliqueEcrire_1, inegalite_*, cochegroupemots_*.

- **Contenu :** un bloc JSON encodé dans `JSON.parse("...")`. Il contient `adaptedExercise.instruction` et `adaptedExercise.statement.pages[].lines[].contents[]`, avec des éléments de type `text`, `whitespace`, `selectableInput` et `multipleChoicesInput`.
- **Clé `studentAnswersStorageKey` :** elle doit être différente pour chaque fichier et chaque langue.
- **Libellés d'interface** (« Effacer mes réponses », « Erase my answers »…) : ils sont dans le code. Le reste du code est identique entre fichiers, d'une langue à l'autre.
- **Espacements :** ce sont des variables CSS dans le code, par exemple `"--vertical-space-between-statement-lines":3.6`. C'est la seule différence entre `cochegroupemots_ligne` (3,6) et `cochegroupemots_colonne` (2,4).
- **Traduction :** remplacer les textes dans le JSON en gardant la structure. Le skill `html-exercice-modifiable` explique la méthode.
- **Espaces insécables** (` `) : les fichiers coche les utilisent dans les groupes de mots et avant les tirets (` – `), pour qu'un groupe ne soit jamais coupé.

### 2. Moteur « classique » (jQuery, `communs/classe_exercice.*`)

Exercices concernés : EcritureNombres, Comptage, Decomposition, CM_Math, AdditionsPosees, GroupeEchange.

- **Contenu :** dans `liste_exercices[...]`.
- **Hauteur des cellules :** `communs/classe_exercice.css` fixe `.contenu_page { line-height: 3.5em }`, soit 112 px. C'est ce qui rend les cases de l'addition très hautes.
- **Variante `_2` de l'addition :** `AdditionsPosees_2.html`, `AdditionsPosees_EN_2.html` et `AdditionsPosees_IT_2.html` sont des copies auxquelles on a ajouté, juste avant `</head>`, la règle `.operation_posee td { line-height: 80px !important; }`. Les cases passent de 94 à 69 px, les chiffres restent à 48 px, et la hauteur nécessaire passe de 779 à 651 px.

## Correspondance des 16 exercices

Les blocs Qualtrics, les fichiers HTML et les cahiers PDF n'ont pas la même numérotation :

| Bloc Qualtrics | Fichier HTML (FR) | Exercice du PDF | Image d'origine |
|---|---|---|---|
| GroupeEchange | GroupeEchange | 1 | GroupeEchange.png |
| Comptage | Comptage | 2 | Comptage.png |
| EcritureNombres | EcritureNombres | 3 | EcritureNombres.png |
| CM_Math | CM_Math | 4 | CM_Math.png |
| Decomposition | Decomposition | 5 | Decomposition.png |
| AdditionsPosees | AdditionsPosees | 6 | AdditionsPosees.png |
| Classe | Classe | 7 | Classe.png |
| CocheGroupeMot | CocheGroupeMots | 8 | CocheGroupeMots.png |
| Associe | associe_colonne_noms | 9 | Associe.png |
| CliqueEcrire | CliqueEcrire_1 | 10 | CliqueEcrire.png |
| CochePhrase | CochePhrase | 11 | CochePhrase.png |
| RC | RC | 12 | RC.png |
| CacheIntrus | CacheIntrus | 13 | CacheIntrus.png |
| EditePhrase | EditPhrase | 14 | EditPhrase.png |
| TransformeMot | TransformeMot | 15 | TransformeMot.png |
| RCDouble | RCDouble | 16 | RCDouble.png |

Les noms de fichiers ne disent pas toujours le contenu : `RC.html` contient l'exercice 12, `TransformeMot.html` l'exercice 15, `RCDouble.html` l'exercice 16.

Sources des images d'origine : les cahiers PDF « Manuel d'exercices Mathématiques et Français », « Exercise book » (EN) et « Eserciziario » (IT). Les images sont découpées à 200 ppp et affichées à 0,945 × leur taille, la même échelle que les images françaises de Qualtrics.

## Le questionnaire Qualtrics

**Enquête :** `SV_9FWbXHzZGFZlENw` (statut inactif, aucune réponse collectée). La question de pays est `QID33`, export `Q33`, avec les choix 1 Ireland, 2 United Kingdom, 3 France, 4 Italy.

### Flux, identique dans les quatre branches

1. Introduction : bienvenue, consentement en iframe (le refus mène à la fin), accord pour être recontacté.
2. Profil : parent, enseignant du primaire, professionnel de santé, jeune adulte (18-25 ans).
3. Un bloc démographique selon le profil.
4. Consigne des exercices (iframe `consignes/consigne_exercices_XX.html`).
5. Les 16 exercices dans un ordre aléatoire (BlockRandomizer). Chaque bloc contient :
   - l'image d'origine ;
   - l'iframe de l'exercice (`<div class="jl-adaptation-wrap"><iframe ...></div>`) avec la case « au bout de l'exercice » ;
   - trois notes de 1 à 5 : globale, motrice, visuo-spatiale.
6. Consigne des comparaisons.
7. Les 5 comparaisons, dans un ordre aléatoire.

| Branche | Choix de Q33 | QID | Préfixe d'export | Introduction | Profil |
|---|---|---|---|---|---|
| Irlande | 1 | QID324 à QID467 | `IE_` | QID324-326 | QID327 |
| Royaume-Uni | 2 | QID468 à QID611 | `UK_` | QID468-470 | QID471 |
| France | 3 | QID98 à QID323 (non contigus) | `FR_` | QID173, 171, 172 | QID174 |
| Italie | 4 | QID612 à QID755 | `IT_` | QID612-614 | QID615 |

Les branches IE, UK et IT ont été générées en clonant la branche France : même structure, textes traduits, et listes adaptées à chaque pays (diplômes, écoles, professionnels, plans d'accompagnement).

### Noms d'export

- **Questions démographiques :** `<pays>_Q<numéro du QID français>`. Par exemple, `FR_Q176`, `IE_Q176`, `UK_Q176` et `IT_Q176` désignent la même question.
- **Exercices :** `<pays>_<bloc>_orig`, `_done`, `_overall`, `_motor`, `_visuospatial`.
- **Comparaisons :** `<pays>_inegalite`, `<pays>_CM_carre_colonne`, `<pays>_Coche_cadre_colonne`, `<pays>_coche_ligne_cadre`, `<pays>_coche_ligne_colonne`.

### Règles d'exploitabilité du CSV (à préserver)

- **Unicité :** aucun nom d'export en double.
- **Réponses obligatoires :** toutes les questions du flux sont en `ForceResponse: ON`.
- **Virgules :** aucun libellé de choix multiple (`MAVR`) ne doit contenir de virgule, car Qualtrics sépare les réponses multiples par des virgules.
- **Listes déroulantes :** les `RecodeValues` exportent la valeur affichée (« 70+ » donne 70, « pas encore de diagnostic » donne 0).
- **Comparaisons :** chaque choix est une image GitHub Pages, suivie d'un code masqué `<span class="jl-code" style="display:none">code</span>`. Les codes sont aussi dans `VariableNaming` et `RecodeValues` :

  | Comparaison | Code texte | Code numérique |
  |---|---|---|
  | Inégalités | `semantique` / `symbole` | 1 / 2 |
  | CM | `carre` / `colonne` | 1 / 2 |
  | Coche | `cadre` / `colonne` / `ligne` | 1 / 2 / 3 |

- **Anciens blocs :** les anciens blocs anglais (avant le modèle France) sont dans la corbeille de Qualtrics.

### QID des comparaisons (repris dans le CSS)

| Branche | QID |
|---|---|
| France | QID98, QID103, QID315, QID316, QID317 |
| Irlande | QID463 à QID467 |
| Royaume-Uni | QID607 à QID611 |
| Italie | QID751 à QID755 |

### Modifier le .qsf

- **Format :** garder celui de l'export Qualtrics, c'est-à-dire du JSON compact, avec les caractères non ASCII en `\uXXXX` et les `/` échappés en `\/`. En Python : `json.dumps(d, ensure_ascii=True, separators=(",", ":")).replace("/", "\\/")`.
- **CSS :** le CSS général est aussi stocké dans le .qsf, dans `SurveyElements` (élément `SO`), `Payload.CustomStyles.customCSS`. Le garder identique à `qualtrics/style_general.css`.
- **Nouvelles questions :** les QID suivent le compteur de l'élément `QC` (actuellement 755).
- **Après chaque modification, vérifier :**
  - chaque question est dans un seul bloc ;
  - les blocs du flux existent ;
  - les logiques d'affichage et de branchement pointent vers des questions qui précèdent ;
  - aucun nom d'export n'est en double ;
  - toutes les questions sont obligatoires ;
  - aucune virgule dans les choix multiples ;
  - les fichiers référencés sur GitHub Pages existent dans le dépôt.

## CSS général (`qualtrics/style_general.css`)

- **Haut de page :** suppression du grand blanc et des en-têtes Qualtrics. Le questionnaire utilise le moteur moderne (Simple Layout).
- **Texte noir :** `.question` et tous ses descendants (sauf les erreurs) sont forcés en noir. Conséquence : un texte blanc deviendrait visible, d'où le `display:none` pour les codes masqués.
- **Cadre des exercices** `.jl-adaptation-wrap` : `min(96vw, 1400px)` de large, centré, hauteur `100dvh - 160px`, sans plafond. Deux variables sont réglables dans `:root` : `--jl-cadre-largeur-max` et `--jl-cadre-reserve`.
- **Comparaisons :** les règles ciblent les 20 QID avec `:is([id*="QID..."], ...)`, dans 10 listes à tenir à jour.

## Mesures de hauteur (défilement dans les exercices)

Mesures faites avec Playwright et Chromium : hauteur dont l'exercice a besoin pour s'afficher sans défilement, dans un cadre large (environ 1300 à 1400 px).

| Exercice | Hauteur nécessaire |
|---|---|
| AdditionsPosees | 779 px (651 px en version `_2`) |
| CliqueEcrire_1 (page 1) | ≈ 700 px |
| Classe (IT, le plus long) | ≈ 620 px |
| TransformeMot | ≈ 585 px |
| Tous les autres | ≤ 520 px |

Tailles de cadre avec le CSS actuel :

| Écran | Cadre |
|---|---|
| Petit portable (1366 × 768) | ≈ 1311 × 490 |
| Portable courant | ≈ 1382 × 620 |
| Écran de bureau | ≈ 1400 × 790 |

**Piège de mesure :** l'addition défile dans une zone interne (`overflow: auto`), pas dans la page. Il faut mesurer `scrollHeight - clientHeight` sur tous les éléments défilants, pas seulement sur le document.

**Aperçu Qualtrics :** il est petit (environ 580 px de haut, cadre réduit à 400 px). Il vaut mieux tester avec le lien de diffusion, en plein écran.

## Captures des comparaisons (pour les refaire)

- **Fenêtre :** 1290 × 610 px, facteur de pixels 2000/1290, ce qui donne des images de 2000 × 946.
- **État capturé :**
  - associe et inégalités : passer à l'item b (clic sur la flèche de droite), puis ouvrir le menu de choix ;
  - coche : état initial, sans clic.
- **CM carré :** utiliser la consigne courte de `associe_colonne` à la place de celle de `associe_carre`, qui liste les verbes. On le fait sur une copie temporaire, pour que la capture corresponde à la version française.

## Environnement

- **Navigateur :** Playwright pour Node est installé globalement (`NODE_PATH=$(npm root -g)`), avec Chromium.
- **Réseau :** `*.qualtrics.com` est bloqué par le proxy. Il n'est pas possible de télécharger les images de la bibliothèque Qualtrics : demander à l'utilisateur de les envoyer.

## Reste à faire (au 13 octobre 2026)

- **Addition :** le .qsf pointe encore vers `AdditionsPosees.html`, `_EN` et `_IT`, pas vers les versions `_2`. C'est à l'utilisateur de décider.
- **Publication :** les fichiers ajoutés depuis la fusion n°10 ne sont pas encore sur `main` (CSS du cadre élargi, additions `_2`, ce fichier).
- **Italie :** la fiche d'information est à créer, et le consentement italien à faire relire.
- **Recontact :** la question n'est précisée que pour la France (focus groups en Île-de-France).
- **Branche France :** les images d'origine viennent encore de la bibliothèque Qualtrics. Des versions refaites existent dans `images/originaux/FR/`.
