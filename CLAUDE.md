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
- Plusieurs sessions Claude travaillent sur ce dépôt, chacune sur sa branche, et `main` avance souvent : toujours repartir de `main` à jour avant un nouveau travail.

### Arborescence

| Élément | Contenu |
|---|---|
| `*.html` à la racine | Les exercices. Version française sans suffixe, `_EN` (Irlande et Royaume-Uni), `_IT` (Italie). |
| `communs/` | CSS et JS partagés par les exercices « classiques » (maths). Ne pas modifier : touche tous les exercices de maths. |
| `consignes/` | Pages de consigne intégrées en iframe : `consigne_exercices_{FR,EN,IT}.html` (texte et images fixes), `consigne_exercices_demo_{FR,EN,IT}.html` (GIF de démonstration), `consigne_comparaison_{FR,EN,IT}.html`. |
| `demos/` | GIF animés des consignes. |
| `images/originaux/{FR,EN,IT}/` | Captures des 16 exercices d'origine, découpées dans les cahiers d'exercices PDF. |
| `images/comparaisons/{FR,EN,IT}/` | Captures des 7 versions comparées. |
| `consent-form-tricolore.html`, `_FR`, `_IT` | Formulaires de consentement, en iframe dans l'introduction. |
| `fiche_information_{FR,EN,IT}.html` | Notices d'information. Dans le .qsf, seule la branche France y renvoie ; les branches IE, UK et IT renvoient encore à l'ancienne fiche de Limerick hébergée par Qualtrics (`File.php?F=F_0PArUWsokMQDzcG`). |
| `guide_animateur/` | Guide imprimable pour les sessions de formation (PDF, captures, scripts de génération ; voir son README). |
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

Le texte de chaque question, ses choix de réponse avec leurs codes, ses conditions d'affichage, ainsi que le contenu de chaque exercice et de chaque comparaison, sont dans la partie **« Dictionnaire détaillé du questionnaire »** à la fin de ce fichier. Si le .qsf change, mettre cette partie à jour.

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

- **Addition :** le .qsf pointe encore vers `AdditionsPosees.html`, `_EN` et `_IT`, pas vers les versions `_2` (publiées sur `main`). C'est à l'utilisateur de décider.
- **Fiches d'information :** les versions EN et IT existent ; le .qsf des branches IE, UK et IT renvoie encore à l'ancienne fiche de Limerick. À faire pointer vers `fiche_information_EN.html` et `fiche_information_IT.html` si l'utilisateur le souhaite.
- **Italie :** le consentement italien est à faire relire.
- **Recontact :** la question n'est précisée que pour la France (focus groups en Île-de-France).
- **Branche France :** les images d'origine viennent encore de la bibliothèque Qualtrics. Des versions refaites existent dans `images/originaux/FR/`.

## Dictionnaire détaillé du questionnaire

Cette partie est générée à partir de `qualtrics/Lab2School4All_6.qsf`. Elle permet de répondre à toute question sur le contenu du questionnaire sans ouvrir le .qsf.

**Conventions :**
- **Nom d'export :** le nom de colonne dans le CSV est `<pays>_<suffixe>`, avec `<pays>` = `FR`, `IE`, `UK` ou `IT`. Les questions sont présentées par leur suffixe.
- **Code :** la valeur exportée en mode « valeurs numériques ». Pour les choix multiples, le CSV contient les codes choisis séparés par des virgules. En mode « texte des choix », le CSV contient le libellé de la langue du participant.
- **[+ texte libre] :** le choix ouvre une zone de texte, exportée dans une colonne supplémentaire `<pays>_<suffixe>_<code>_TEXT`.
- **Obligatoire :** toutes les questions avec réponse sont obligatoires, sauf mention contraire.
- **EN :** quand l'Irlande (IE) et le Royaume-Uni (UK) ont le même texte, il n'est donné qu'une fois sous « EN ».

### Question de pays (commune, avant les branches)

- **Nom d'export :** `Q33` ; choix unique.
- **Texte (trilingue) :** Please indicate which country you are completing this survey from; Veuillez indiquer le pays depuis lequel vous complétez ce questionnaire ; Si prega di indicare il Paese da cui si compila questo questionario.
- **Choix :** 1 = Ireland (branche IE, en anglais), 2 = United Kingdom (branche UK, en anglais), 3 = France (branche FR), 4 = Italy (branche IT, en italien).

### Introduction et profil

#### `Q173` Bienvenue et notice d'information

- QID FR QID173, IE QID324, UK QID468, IT QID612 ; texte / média (pas de réponse).
- **FR :** Bienvenue. Veuillez lire la notice d'information accessible via ce lien avant de décider de participer à cette étude : [ Notice d'information Lab2school4all ]. Ce document présente les aspects essentiels de ce projet de recherche ainsi que vos droits en tant que participant.
- **EN :** Welcome. Please read the information sheet attached in this link before deciding whether to participate in this study Lab2school4all information sheet This information sheet provides important information about this research study and information regarding your rights as a research participant
- **IT :** Benvenuto/a. La preghiamo di leggere la scheda informativa disponibile a questo link prima di decidere se partecipare a questo studio: [ Scheda informativa Lab2school4all ]. Questo documento presenta gli aspetti essenziali di questo progetto di ricerca e i Suoi diritti in quanto partecipante.

#### `Q171` Consentement

- QID FR QID171, IE QID325, UK QID469, IT QID613 ; choix unique.

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | J'accepte de participer | I agree to participate | Accetto di partecipare |
| 2 | Je n'accepte pas de participer | I do not agree to participate | Non accetto di partecipare |

#### `Q172` Accord pour être recontacté

- QID FR QID172, IE QID326, UK QID470, IT QID614 ; choix unique.
- **FR :** Accord pour participer à des futures recherches similaires Dans le cadre de la deuxième phase de cette recherche, nous organiserons des groupes de discussion (focus groups) d'une demi-journée en Île-de-France, entre février et mars 2027. Acceptez-vous d’être recontacté(e) par l’équipe de recherche afin de recevoir les informations détaillées concernant cette seconde phase et d’envisager votre participation ? Vos coordonnées seront alors conservées par l'équipe à cette seule fin jusqu'à la fin de la période de recrutement.
- **EN :** Consent to Contact about Similar Future Research I explicitly consent to the University contacting me as part of current or similar future research and holding my contact details on its database for the purpose of contacting me.
- **IT :** Consenso a essere ricontattato/a per ricerche future simili Acconsento esplicitamente a che l'Università mi contatti nell'ambito della ricerca attuale o di future ricerche simili e conservi i miei recapiti nel proprio database a tale scopo.

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Oui, j'envisage de participer à ces discussions et j'indique un mail auquel me contacter : [+ texte libre] | Yes, please provide your e-mail contact details: [+ texte libre] | Sì, indico un indirizzo e-mail a cui contattarmi: [+ texte libre] |
| 2 | Non je préfère ne pas donner mes coordonées pour être recontacté. | No | No, preferisco non lasciare i miei recapiti. |

Le consentement est affiché dans une iframe : `consent-form-tricolore_FR.html` (FR), `consent-form-tricolore.html` (IE et UK), `consent-form-tricolore_IT.html` (IT). Répondre « je n'accepte pas » (code 2) termine le questionnaire.

#### `Q174` Profil du répondant

- QID FR QID174, IE QID327, UK QID471, IT QID615 ; choix unique.
- **FR :** Vous répondez à ce questionnaire parce que vous êtes :
- **EN :** You are completing this survey as a:
- **IT :** Lei risponde a questo questionario in qualità di:

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Parent / Personne en charge d'un enfant dyspraxique | Parent / carer of a child with DCD/dyspraxia | Genitore / persona che si prende cura di un bambino con disprassia |
| 2 | Professeur des écoles | Primary school teacher | Insegnante di scuola primaria |
| 3 | Professionnel de santé (ergothérapeutes, psychomotriciens) | Health professional (occupational therapist, physiotherapist) | Professionista sanitario (terapista della neuro e psicomotricità dell'età evolutiva, terapista occupazionale) |
| 4 | Jeune adulte dyspraxique (18-25 ans) | Young adult (18-25 years) with DCD/dyspraxia | Giovane adulto con disprassia (18-25 anni) |

Ce choix détermine le bloc démographique affiché ensuite (code 1 parents, 2 enseignants, 3 professionnels de santé, 4 jeunes adultes).

### Bloc démographique : parents (profil = 1)

Bloc Qualtrics « Parent/Caregiver Questions _FR » et ses équivalents `_IE`, `_UK`, `_IT`. Questions dans l'ordre d'affichage :

#### `Q175` 

- QID FR QID175, IE QID328, UK QID472, IT QID616 ; choix unique.
- **FR :** Quel est votre genre
- **EN :** What is your gender?
- **IT :** Qual è il Suo genere?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Femme | Woman | Donna |
| 2 | Homme | Man | Uomo |
| 3 | Non-binaire / autre identité de genre | Non-binary / other gender identity | Non binario / altra identità di genere |
| 4 | Je préfère me définir comme : [+ texte libre] | I prefer to self-describe as: [+ texte libre] | Preferisco descrivermi come: [+ texte libre] |
| 5 | Je préfère ne pas répondre | I prefer not to say | Preferisco non rispondere |

#### `Q176` 

- QID FR QID176, IE QID329, UK QID473, IT QID617 ; liste déroulante.
- **FR :** Quel âge avez-vous ?
- **EN :** How old are you?
- **IT :** Quanti anni ha?
- **Choix :** liste de 18 à 70+. Le code exporté est le nombre affiché (« 70+ » donne 70).

#### `Q177` 

- QID FR QID177, IE QID330, UK QID474, IT QID618 ; choix unique.
- **FR :** Quel est le diplôme le plus élevé que vous avez obtenu ?
- **EN :** What is the highest qualification you have obtained?
- **IT :** Qual è il titolo di studio più alto che ha conseguito?

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Scolarité interrompue sans diplôme | Left school with no qualifications | Left school with no qualifications | Nessun titolo di studio / licenza elementare |
| 2 | Brevet des collèges | Junior Certificate / Junior Cycle | GCSEs / O levels (or equivalent) | Licenza media |
| 3 | CAP, BEP, baccalauréat, brevet professionnel | Leaving Certificate, apprenticeship or QQI Level 5 award | A levels, BTEC, NVQ or apprenticeship (or equivalent) | Diploma di scuola secondaria di secondo grado o qualifica professionale |
| 4 | BTS, DUT, DEUST | Higher Certificate or QQI Level 6 award | Higher National Certificate / Diploma (HNC, HND) or foundation degree | Diploma di Istruzione Tecnica Superiore (ITS) |
| 5 | Diplôme d'État (Psychomotricité, Ergothérapie) | Professional health qualification (e.g. occupational therapy, physiotherapy) | Professional health qualification (e.g. occupational therapy, physiotherapy) | Laurea delle professioni sanitarie (es. TNPEE, terapia occupazionale, fisioterapia) |
| 6 | Licence | Bachelor's degree | Bachelor's degree | Laurea triennale |
| 7 | Master | Master's degree | Master's degree | Laurea magistrale o a ciclo unico |
| 8 | Doctorat | Doctorate (PhD) | Doctorate (PhD) | Dottorato di ricerca |
| 9 | autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q178` 

- QID FR QID178, IE QID331, UK QID475, IT QID619 ; choix unique.
- **FR :** Quel est le genre de votre enfant dyspraxique ?
- **EN :** What is the gender of your child with DCD/dyspraxia?
- **IT :** Qual è il genere di Suo figlio/Sua figlia con disprassia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Fille | Girl | Femmina |
| 2 | Garçon | Boy | Maschio |
| 3 | Non-binaire / autre identité de genre | Non-binary / other gender identity | Non binario / altra identità di genere |
| 4 | Mon enfant décrit sont identité de genre comme : [+ texte libre] | My child describes their gender identity as: [+ texte libre] | Mio figlio/Mia figlia descrive la propria identità di genere come: [+ texte libre] |
| 5 | Je préfère ne pas répondre | I prefer not to say | Preferisco non rispondere |

#### `Q179` 

- QID FR QID179, IE QID332, UK QID476, IT QID620 ; liste déroulante.
- **FR :** Quel âge a votre enfant dyspraxique ?
- **EN :** How old is your child with DCD/dyspraxia?
- **IT :** Quanti anni ha Suo figlio/Sua figlia con disprassia?
- **Choix :** liste de 3 à 30+. Le code exporté est le nombre affiché (« 30+ » donne 30).

#### `Q180` 

- QID FR QID180, IE QID333, UK QID477, IT QID621 ; liste déroulante.
- **FR :** À quel âge les difficultés de votre enfant ont-elles commencé ?
- **EN :** At what age did your child's difficulties begin?
- **IT :** A che età sono iniziate le difficoltà di Suo figlio/Sua figlia?
- **Choix :** liste de 1 à 15+. Le code exporté est le nombre affiché (« 15+ » donne 15).

#### `Q181` 

- QID FR QID181, IE QID334, UK QID478, IT QID622 ; liste déroulante.
- **FR :** À quel âge le diagnostic a-t-il été posé ?
- **EN :** At what age was your child diagnosed?
- **IT :** A che età è stata posta la diagnosi?
- **Choix :** liste de 3 à 18+. Le code exporté est le nombre affiché (« 18+ » donne 18). Choix supplémentaire en tête de liste, code 0 : FR « Le diagnostic n'a pas encore été posé » ; IE « My child has not been diagnosed yet » ; UK « My child has not been diagnosed yet » ; IT « La diagnosi non è ancora stata posta ».

#### `Q182` 

- QID FR QID182, IE QID335, UK QID479, IT QID623 ; choix multiples.
- **FR :** Qui à posé le diagnostique de dyspraxie de votre enfant ? (Plusieurs réponses possibles)
- **EN :** Who diagnosed your child's DCD/dyspraxia? (Tick all that apply)
- **IT :** Chi ha posto la diagnosi di disprassia di Suo figlio/Sua figlia? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Un psychiatre | A psychiatrist | A psychiatrist | Un neuropsichiatra infantile |
| 2 | Un pédiatre | A paediatrician | A paediatrician | Un pediatra |
| 3 | Un psychologue (hypothèse de diagnostique) | A psychologist (suggested diagnosis) | A psychologist (suggested diagnosis) | Uno psicologo (ipotesi diagnostica) |
| 4 | Un psychomotricien (hypothèse de diagnostique) | A physiotherapist (suggested diagnosis) | A physiotherapist (suggested diagnosis) | Un terapista della neuro e psicomotricità dell'età evolutiva / TNPEE (ipotesi diagnostica) |
| 5 | Un ergothérapeute (hypothèse de diagnostique) | An occupational therapist (suggested diagnosis) | An occupational therapist (suggested diagnosis) | Un terapista occupazionale (ipotesi diagnostica) |
| 6 | Une équipe pluridisciplinaire | A multidisciplinary team (e.g. Children's Disability Network Team / CDNT) | A multidisciplinary team (e.g. Child Development Centre) | Un'équipe multidisciplinare (es. servizio di NPIA) |
| 7 | Personne | No one | No one | Nessuno |
| 8 | Diagnostique en cours | Diagnosis in progress | Diagnosis in progress | Diagnosi in corso |
| 9 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q183` 

- QID FR QID183, IE QID336, UK QID480, IT QID624 ; choix multiples.
- **FR :** Un ou plusieurs autres troubles ont-ils été diagnostiqués chez votre enfant présentant une dyspraxie ? (Plusieurs réponses possibles)
- **EN :** Has your child with DCD/dyspraxia been diagnosed with one or more other conditions? (Tick all that apply)
- **IT :** Sono stati diagnosticati a Suo figlio/Sua figlia con disprassia uno o più altri disturbi? (Sono possibili più risposte)

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Aucun | None | Nessuno |
| 2 | Dyslexie | Dyslexia | Dislessia |
| 3 | Dyscalculie | Dyscalculia | Discalculia |
| 4 | TDA / TDAH | ADD / ADHD | ADHD (disturbo da deficit di attenzione/iperattività) |
| 5 | Autisme / Trouble du Spectre Autistique | Autism / autism spectrum disorder | Autismo / disturbo dello spettro autistico |
| 6 | Dysphasie | Developmental language disorder (DLD) | Disturbo del linguaggio |
| 7 | Autre : [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q205` 

- QID FR QID205, IE QID337, UK QID481, IT QID625 ; choix unique.
- **FR :** Avez-vous déjà réduit ou arrêté votre activité professionnelle en raison des difficultés de votre enfant ?
- **EN :** Have you ever reduced or stopped your paid work because of your child's difficulties?
- **IT :** Ha mai ridotto o interrotto la Sua attività lavorativa a causa delle difficoltà di Suo figlio/Sua figlia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Oui | Yes | Sì |
| 2 | Non | No | No |

#### `Q184` 

- QID FR QID184, IE QID338, UK QID482, IT QID626 ; choix multiples.
- **FR :** Quelle école a fréquenté votre enfant dyspraxique ?
- **EN :** Which schools has your child with DCD/dyspraxia attended? (Tick all that apply)
- **IT :** Quali scuole ha frequentato Suo figlio/Sua figlia con disprassia? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | École maternelle | Preschool / early years | Nursery / preschool | Scuola dell'infanzia |
| 2 | École primaire | Primary school | Primary school | Scuola primaria |
| 3 | Collège | Post-primary school (Junior Cycle) | Secondary school | Scuola secondaria di primo grado (scuola media) |
| 4 | Lycée | Post-primary school (Senior Cycle) | Sixth form or further education college | Scuola secondaria di secondo grado |
| 5 | Études supérieures | Further or higher education | Higher education (university) | Università / formazione superiore |
| 6 | autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q185` 

- QID FR QID185, IE QID339, UK QID483, IT QID627 ; choix multiples.
- **FR :** Veuillez sélectionner toutes les écoles, classes ou structures que votre enfant dyspraxique a fréquenté au cours de sa scolarité dans le primaire .
- **EN :** Please select all the schools, classes or settings your child with DCD/dyspraxia attended during primary school .
- **IT :** Selezioni tutte le scuole, classi o strutture che Suo figlio/Sua figlia con disprassia ha frequentato durante la scuola primaria .

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | École publique | Mainstream primary school (national school) | State-funded school (local authority maintained) | Scuola statale |
| 2 | École privée sous contrat | Gaelscoil / Irish-medium school | Academy or free school | Scuola paritaria |
| 3 | École privée hors contrat | Private (fee-paying) primary school | Independent (private) school | Scuola privata non paritaria |
| 4 | Classe Ulis | Special class in a mainstream school | Specialist unit or resource base within a mainstream school | Classe con il supporto di un insegnante di sostegno |
| 5 | École à la maison / CNED | Home education | Home education | Istruzione parentale (homeschooling) |
| 6 | Période(s) de déscolarisation | Period(s) out of school | Period(s) out of school | Periodo/i di non frequenza scolastica |
| 7 | Scolarisation à la maison associative (type "Votre école chez vous") | School serving a socio-economically disadvantaged community (DEIS) | Alternative provision (e.g. hospital school or pupil referral unit) | Scuola in ospedale o istruzione domiciliare |
| 8 | Établissement médico-social (IME / ITEP / DITEP / IEM...) | Special school | Special school | Centro di riabilitazione o struttura socio-sanitaria con attività scolastica |
| 9 | autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q186` 

- QID FR QID186, IE QID340, UK QID484, IT QID628 ; choix unique.
- **FR :** Votre enfant utilisait-il des exercices de manuels scolaires ayant fait l'objet d'une adaptation ?
- **EN :** Did your child use adapted textbook exercises?
- **IT :** Suo figlio/Sua figlia utilizzava esercizi di libri di testo adattati?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Oui | Yes | Sì |
| 2 | Non | No | No |

#### `Q187` 

- QID FR QID187, IE QID341, UK QID485, IT QID629 ; choix unique ; affichée seulement si `Q186` = 2 (Non).
- **FR :** Pour quelle raison ?
- **EN :** Why not?
- **IT :** Per quale motivo?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Il n'y en avait pas de disponible | None were available | Non ce n'erano di disponibili |
| 2 | Ils n'étaient pas considérés comme nécessaires | They were not considered necessary | Non erano ritenuti necessari |
| 3 | Autre [+ texte libre] | Other [+ texte libre] | Altro [+ texte libre] |

#### `Q188` 

- QID FR QID188, IE QID342, UK QID486, IT QID630 ; choix multiples ; affichée seulement si `Q186` = 1 (Oui).
- **FR :** Sélectionnez tous les types d'exercices adaptés que votre enfant à utilisé :
- **EN :** Select all the types of adapted exercises your child has used:
- **IT :** Selezioni tutti i tipi di esercizi adattati che Suo figlio/Sua figlia ha utilizzato:

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Exercices de math adaptés de manuels imprimés | Adapted maths exercises from printed textbooks | Adapted maths exercises from printed textbooks | Esercizi di matematica adattati da libri di testo cartacei |
| 2 | Exercices de français adaptés de manuels imprimés | Adapted English or Irish exercises from printed textbooks | Adapted English exercises from printed textbooks | Esercizi di italiano adattati da libri di testo cartacei |
| 3 | Exercices de math adaptés de manuels numériques | Adapted maths exercises from digital textbooks | Adapted maths exercises from digital textbooks | Esercizi di matematica adattati da libri di testo digitali |
| 4 | Exercices de français adaptés de manuels numériques | Adapted English or Irish exercises from digital textbooks | Adapted English exercises from digital textbooks | Esercizi di italiano adattati da libri di testo digitali |
| 5 | Des exercices adaptés par les enseignants | Exercises adapted by teachers | Exercises adapted by teachers | Esercizi adattati dagli insegnanti |
| 6 | Des exercices que vous avez adapté vous même | Exercises you adapted yourself | Exercises you adapted yourself | Esercizi che ha adattato Lei stesso/a |
| 7 | Des exercices recommandés ou créés par des ergothérapeutes / des psychomotriciens | Exercises recommended or created by occupational therapists / physiotherapists | Exercises recommended or created by occupational therapists / physiotherapists | Esercizi consigliati o creati da terapisti (TNPEE o terapisti occupazionali) |
| 8 | Des manuels déjà adaptés disponibles à l'achat | Ready-made adapted textbooks available to buy | Ready-made adapted textbooks available to buy | Libri di testo già adattati disponibili in commercio |
| 12 | Autre [+ texte libre] | Other [+ texte libre] | Other [+ texte libre] | Altro [+ texte libre] |

#### `Q189` 

- QID FR QID189, IE QID343, UK QID487, IT QID631 ; choix unique ; affichée seulement si `Q186` = 1 (Oui).
- **FR :** Globalement, comment évaluez vous l'efficacité de ces adaptions pour l'apprentissage de votre enfant ?
- **EN :** Overall, how would you rate the effectiveness of these adaptations for your child's learning?
- **IT :** Nel complesso, come valuta l'efficacia di questi adattamenti per l'apprendimento di Suo figlio/Sua figlia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | 1 – Pas du tout efficace | 1 - Not effective | 1 - Per niente efficace |
| 2 | 2 – Plutot pas efficace | 2 - Slightly effective | 2 - Poco efficace |
| 3 | 3 – Neutre | 3 - Neutral | 3 - Neutro |
| 4 | 4 – Plutot efficace | 4 - Pretty effective | 4 - Abbastanza efficace |
| 5 | 5 – Très efficace | 5 - Very effective | 5 - Molto efficace |

### Bloc démographique : enseignants (profil = 2)

Bloc Qualtrics « Teacher Questions _FR » et ses équivalents `_IE`, `_UK`, `_IT`. Questions dans l'ordre d'affichage :

#### `Q191` 

- QID FR QID191, IE QID344, UK QID488, IT QID632 ; choix unique.
- **FR :** Quel est votre genre ?
- **EN :** What is your gender?
- **IT :** Qual è il Suo genere?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Femme | Woman | Donna |
| 2 | Homme | Man | Uomo |
| 3 | Non-binaire / autre identité de genre | Non-binary / other gender identity | Non binario / altra identità di genere |
| 4 | Je préfère me définit comme : [+ texte libre] | I prefer to self-describe as: [+ texte libre] | Preferisco descrivermi come: [+ texte libre] |
| 5 | Je préfère ne pas réponse | I prefer not to say | Preferisco non rispondere |

#### `Q192` 

- QID FR QID192, IE QID345, UK QID489, IT QID633 ; liste déroulante.
- **FR :** Quel âge avez-vous ?
- **EN :** How old are you?
- **IT :** Quanti anni ha?
- **Choix :** liste de 18 à 70+. Le code exporté est le nombre affiché (« 70+ » donne 70).

#### `Q193` 

- QID FR QID193, IE QID346, UK QID490, IT QID634 ; choix unique.
- **FR :** Quel est le diplôme le plus élevé que vous avez obtenu ?
- **EN :** What is the highest qualification you have obtained?
- **IT :** Qual è il titolo di studio più alto che ha conseguito?

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Baccalauréat | Leaving Certificate | A levels (or equivalent) | Diploma di scuola secondaria di secondo grado (incluso il diploma magistrale) |
| 2 | Diplôme d'État (Psychomotricité, Ergothérapie) | Bachelor of Education (BEd) | Foundation degree / HND | Laurea triennale |
| 3 | DEUG | Other bachelor's degree | Bachelor's degree (including BEd) | Laurea magistrale a ciclo unico in Scienze della Formazione Primaria |
| 4 | Licence | Professional Master of Education (PME) | Postgraduate teaching qualification (PGCE, PGDE) | Altra laurea magistrale |
| 5 | Master | Other master's degree | Master's degree | Specializzazione per le attività di sostegno (TFA sostegno) o master universitario |
| 6 | Doctorat | Doctorate (PhD) | Doctorate (PhD) | Dottorato di ricerca |
| 7 |  | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

Attention : les codes diffèrent selon les pays pour cette question ; FR : 1, 2, 3, 4, 5, 6 ; IE : 1, 2, 3, 4, 5, 6, 7 ; UK : 1, 2, 3, 4, 5, 6, 7 ; IT : 1, 2, 3, 4, 5, 6, 7.

#### `Q194` 

- QID FR QID194, IE QID347, UK QID491, IT QID635 ; liste déroulante.
- **FR :** Depuis combien d'années enseignez-vous ?
- **EN :** How many years have you been teaching?
- **IT :** Da quanti anni insegna?
- **Choix :** liste de 1 à 50. Le code exporté est le nombre affiché (« 50 » donne 50).

#### `Q195` 

- QID FR QID195, IE QID348, UK QID492, IT QID636 ; liste déroulante.
- **FR :** Combien d'années avez vous dû adapter votre enseignement à pour un enfant dyspraxique ?
- **EN :** For how many years have you had to adapt your teaching for a child with DCD/dyspraxia?
- **IT :** Per quanti anni ha dovuto adattare il Suo insegnamento per un bambino con disprassia?
- **Choix :** liste de 1 à 50. Le code exporté est le nombre affiché (« 50 » donne 50).

#### `Q196` 

- QID FR QID196, IE QID349, UK QID493, IT QID637 ; choix multiples.
- **FR :** Dans quelle structure enseignez-vous ?
- **EN :** Where do you teach? (Tick all that apply)
- **IT :** In quale tipo di scuola insegna? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | École maternelle | Early years setting (preschool) | Nursery / early years (EYFS) | Scuola dell'infanzia |
| 2 | École élémentaire | Primary school | Primary school | Scuola primaria |
| 3 | Collège | Post-primary school (Junior Cycle) | Secondary school | Scuola secondaria di primo grado |
| 4 | Lycée général et technologique | Post-primary school (Senior Cycle) | Sixth form | Liceo |
| 5 | Lycée professionnel | Further education and training (FET) | Further education college | Istituto tecnico o professionale |
| 6 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q204` 

- QID FR QID204, IE QID350, UK QID494, IT QID638 ; choix multiples.
- **FR :** Quel est votre statut ?
- **EN :** What is your role?
- **IT :** Qual è il Suo ruolo?

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Enseignant | Mainstream class teacher | Class teacher | Insegnante curricolare |
| 2 | Enseignant spécialisé | Special education teacher (SET) | Special educational needs teacher or SENCo | Insegnante di sostegno |
| 3 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q197` 

- QID FR QID197, IE QID351, UK QID495, IT QID639 ; choix multiples.
- **FR :** Veuillez sélectionner toutes les structures dans lesquelles vous avez enseigné au cours de votre carrière :
- **EN :** Please select all the settings in which you have taught during your career:
- **IT :** Selezioni tutte le strutture in cui ha insegnato nel corso della Sua carriera:

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | École publique | Mainstream primary school (national school) | State-funded school (local authority maintained) | Scuola statale |
| 2 | École privée sous contrat | Gaelscoil / Irish-medium school | Academy or free school | Scuola paritaria |
| 3 | École privée hors contrat | Private (fee-paying) primary school | Independent (private) school | Scuola privata non paritaria |
| 4 | Classe Ulis | Special class in a mainstream school | Specialist unit or resource base within a mainstream school | Classe con il supporto di un insegnante di sostegno |
| 5 | École à la maison / CNED | Home education | Home education | Istruzione parentale (homeschooling) |
| 6 | Scolarisation à la maison associative (type 'Votre école chez vous') | School serving a socio-economically disadvantaged community (DEIS) | Alternative provision (e.g. hospital school or pupil referral unit) | Scuola in ospedale o istruzione domiciliare |
| 7 | Établissement médico-social (IME / ITEP / DITEP / IEM...) | Special school | Special school | Centro di riabilitazione o struttura socio-sanitaria con attività scolastica |
| 8 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q198` 

- QID FR QID198, IE QID352, UK QID496, IT QID640 ; choix unique.
- **FR :** Avez vous adapté des exercices de manuels pour un élève dyspraxique ?
- **EN :** Have you adapted textbook exercises for a pupil with DCD/dyspraxia?
- **IT :** Ha adattato esercizi di libri di testo per un alunno con disprassia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Oui | Yes | Sì |
| 2 | Non | No | No |

#### `Q199` 

- QID FR QID199, IE QID353, UK QID497, IT QID641 ; choix multiples ; affichée seulement si `Q198` = 2 (Non).
- **FR :** Pour quelle raison ?
- **EN :** Why not? (Tick all that apply)
- **IT :** Per quale motivo? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Pas d'élève dyspraxique | No pupil with DCD/dyspraxia | No pupil with DCD/dyspraxia | Nessun alunno con disprassia |
| 2 | Pas de formation sur les besoins spécifiques à la dyspraxie | No training on the specific needs of pupils with DCD/dyspraxia | No training on the specific needs of pupils with DCD/dyspraxia | Nessuna formazione sui bisogni specifici legati alla disprassia |
| 3 | Pas de notification officielle (PPS ou PAP) | No formal plan in place (e.g. Student Support Plan or IEP) | No formal plan in place (e.g. EHC plan or SEN support plan) | Nessuna certificazione o piano formale (PEI o PDP) |
| 4 | Les exercices étaient déjà adaptés pour l'enfant (ergothérapeute ou psychomotricien) | The exercises were already adapted for the child (by an occupational therapist or physiotherapist) | The exercises were already adapted for the child (by an occupational therapist or physiotherapist) | Gli esercizi erano già adattati per il bambino (da un terapista) |
| 5 | Pour ne pas faire de différences avec les autres élèves | To avoid treating the pupil differently from the others | To avoid treating the pupil differently from the others | Per non fare differenze con gli altri alunni |
| 6 | Manque de temps | Lack of time | Lack of time | Mancanza di tempo |
| 7 | Manque de ressources | Lack of resources | Lack of resources | Mancanza di risorse |
| 8 | Autre [+ texte libre] | Other [+ texte libre] | Other [+ texte libre] | Altro [+ texte libre] |

#### `Q200` 

- QID FR QID200, IE QID354, UK QID498, IT QID642 ; choix multiples ; affichée seulement si `Q198` = 1 (Oui).
- **FR :** Sélectionnez tous les types d'adaptation que vous avez réalisées ou utilisées :
- **EN :** Select all the types of adaptation you have made or used:
- **IT :** Selezioni tutti i tipi di adattamento che ha realizzato o utilizzato:

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Exercices de math adaptés de manuels imprimés | Adapted maths exercises from printed textbooks | Adapted maths exercises from printed textbooks | Esercizi di matematica adattati da libri di testo cartacei |
| 2 | Exercices de français adaptés de manuels imprimés | Adapted English or Irish exercises from printed textbooks | Adapted English exercises from printed textbooks | Esercizi di italiano adattati da libri di testo cartacei |
| 3 | Exercices de math adaptés de manuels numériques | Adapted maths exercises from digital textbooks | Adapted maths exercises from digital textbooks | Esercizi di matematica adattati da libri di testo digitali |
| 4 | Exercices de français adaptés de manuels numériques | Adapted English or Irish exercises from digital textbooks | Adapted English exercises from digital textbooks | Esercizi di italiano adattati da libri di testo digitali |
| 5 | Créer des exercices adaptés | Creating adapted exercises | Creating adapted exercises | Creare esercizi adattati |
| 6 | Adapter des exercices créés par les parents | Adapting exercises created by parents | Adapting exercises created by parents | Adattare esercizi creati dai genitori |
| 7 | Adapter des exercices créés par des ergothérapeutes / des psychomotriciens | Adapting exercises created by occupational therapists / physiotherapists | Adapting exercises created by occupational therapists / physiotherapists | Adattare esercizi creati da terapisti (TNPEE o terapisti occupazionali) |
| 8 | Acheté des manuels déjà adaptés pour la dyspraxie | Buying textbooks already adapted for DCD/dyspraxia | Buying textbooks already adapted for DCD/dyspraxia | Acquistare libri di testo già adattati per la disprassia |
| 9 | Adapté des exercices créés par des collègues | Adapting exercises created by colleagues | Adapting exercises created by colleagues | Adattare esercizi creati da colleghi |
| 10 | Adapté des exercices créés par IA | Adapting exercises created by AI | Adapting exercises created by AI | Adattare esercizi creati con l'IA |
| 11 | Autre : | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q201` 

- QID FR QID201, IE QID355, UK QID499, IT QID643 ; choix unique ; affichée seulement si `Q198` = 1 (Oui).
- **FR :** Globalement, comment évaluez vous l'efficacité de cette adaptation pour un enfant dyspraxique ?
- **EN :** Overall, how would you rate the effectiveness of this adaptation for a child with DCD/dyspraxia?
- **IT :** Nel complesso, come valuta l'efficacia di questo adattamento per un bambino con disprassia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | 1 – Pas du tout efficace | 1 - Not effective | 1 - Per niente efficace |
| 2 | 2 – Plutot pas efficace | 2 - Slightly effective | 2 - Poco efficace |
| 3 | 3 – Neutre | 3 - Neutral | 3 - Neutro |
| 4 | 4 – Plutot efficace | 4 - Pretty effective | 4 - Abbastanza efficace |
| 5 | 5 – Très efficace | 5 - Very effective | 5 - Molto efficace |

#### `Q202` 

- QID FR QID202, IE QID356, UK QID500, IT QID644 ; liste déroulante.
- **FR :** Combien d'année d'expérience avez-vous dans l'adaptation d'exercices ?
- **EN :** How many years of experience do you have in adapting exercises?
- **IT :** Quanti anni di esperienza ha nell'adattamento di esercizi?
- **Choix :** liste de 0 à 45+. Le code exporté est le nombre affiché (« 45+ » donne 45).

### Bloc démographique : professionnels de santé (profil = 3)

Bloc Qualtrics « Occupational Therapist Questions _FR » et ses équivalents `_IE`, `_UK`, `_IT`. Questions dans l'ordre d'affichage :

#### `Q206` 

- QID FR QID206, IE QID357, UK QID501, IT QID645 ; choix unique.
- **FR :** Quel est votre genre ?
- **EN :** What is your gender?
- **IT :** Qual è il Suo genere?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Femme | Woman | Donna |
| 2 | Homme | Man | Uomo |
| 3 | Non-binaire / autre identité de genre | Non-binary / other gender identity | Non binario / altra identità di genere |
| 4 | Je préfère me définir comme : [+ texte libre] | I prefer to self-describe as: [+ texte libre] | Preferisco descrivermi come: [+ texte libre] |
| 5 | Je préfère ne pas répondre | I prefer not to say | Preferisco non rispondere |

#### `Q207` 

- QID FR QID207, IE QID358, UK QID502, IT QID646 ; liste déroulante.
- **FR :** Quel âge avez-vous ?
- **EN :** How old are you?
- **IT :** Quanti anni ha?
- **Choix :** liste de 18 à 70+. Le code exporté est le nombre affiché (« 70+ » donne 70).

#### `Q208` 

- QID FR QID208, IE QID359, UK QID503, IT QID647 ; choix unique.
- **FR :** Quel est le diplôme le plus élevé que vous avez obtenu ?
- **EN :** What is the highest qualification you have obtained?
- **IT :** Qual è il titolo di studio più alto che ha conseguito?

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Baccalauréat | Leaving Certificate | A levels (or equivalent) | Diploma di scuola secondaria di secondo grado |
| 2 | Diplôme d'État (Psychomotricité, Ergothérapie) | Bachelor's degree (BSc) in occupational therapy or physiotherapy | Bachelor's degree (BSc) in occupational therapy or physiotherapy | Laurea triennale delle professioni sanitarie (TNPEE, terapia occupazionale, fisioterapia) |
| 3 | DEUG | Other bachelor's degree | Other bachelor's degree | Altra laurea triennale |
| 4 | Licence | Professional / pre-registration master's degree (MSc) in occupational therapy or physiotherapy | Professional / pre-registration master's degree (MSc) in occupational therapy or physiotherapy | Laurea magistrale (es. Scienze riabilitative delle professioni sanitarie) |
| 5 | Master | Other master's degree | Other master's degree | Master universitario |
| 6 | Doctorat | Doctorate (PhD, professional doctorate) | Doctorate (PhD, professional doctorate) | Dottorato di ricerca |
| 7 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q230` 

- QID FR QID230, IE QID360, UK QID504, IT QID648 ; choix multiples.
- **FR :** Dans quelles structures avez vous exercé ?
- **EN :** In which settings have you worked? (Tick all that apply)
- **IT :** In quali strutture ha lavorato? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Cabinet libéral | Private practice | Private practice | Libera professione (studio privato) |
| 2 | CMPP ou CAMSP | HSE services (Primary Care / Children's Disability Network Team) | NHS community children's services (e.g. Child Development Centre) | Servizio pubblico di Neuropsichiatria dell'Infanzia e dell'Adolescenza (NPIA) |
| 3 | Établissement médico-social (IME / ITEP / IEM) | Special school or residential setting | Special school or residential setting | Centro di riabilitazione (accreditato o convenzionato) |
| 4 | Établissement hospitalier | Hospital | Hospital | Ospedale |
| 5 | Intervention en milieu scolaire | School-based service (e.g. In-School Therapy) | School-based service | Intervento in ambito scolastico |
| 6 | Structure associative | Charity or voluntary organisation | Charity or voluntary organisation | Associazione o terzo settore |
| 7 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q231` 

- QID FR QID231, IE QID361, UK QID505, IT QID649 ; choix unique.
- **FR :** Intervenez-vous directement au sein de l'école ou de la structure de scolarisation des enfants que vous suivez ?
- **EN :** Do you work directly in the school or educational setting of the children you support?
- **IT :** Interviene direttamente nella scuola o nella struttura scolastica dei bambini che segue?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Oui, régulièrement | Yes, regularly | Sì, regolarmente |
| 2 | Oui, occasionellement | Yes, occasionally | Sì, occasionalmente |
| 3 | Non | No | No |

#### `Q209` 

- QID FR QID209, IE QID362, UK QID506, IT QID650 ; liste déroulante.
- **FR :** Veuillez indiquer depuis combien d'année vous travaillez avec des enfants dyspraxiques.
- **EN :** Please indicate for how many years you have been working with children with DCD/dyspraxia.
- **IT :** Indichi da quanti anni lavora con bambini con disprassia.
- **Choix :** liste de 1 à 50+. Le code exporté est le nombre affiché (« 50+ » donne 50).

#### `Q213` 

- QID FR QID213, IE QID363, UK QID507, IT QID651 ; choix unique.
- **FR :** Avez vous de l'expérience dans l'adaptation d'exercice pour des enfants dyspraxiques ?
- **EN :** Do you have experience in adapting exercises for children with DCD/dyspraxia?
- **IT :** Ha esperienza nell'adattamento di esercizi per bambini con disprassia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Yes | Yes | Sì |
| 2 | No | No | No |

#### `Q214` 

- QID FR QID214, IE QID364, UK QID508, IT QID652 ; choix unique ; affichée seulement si `Q213` = 2 (No).
- **FR :** Pour quelle raison ?
- **EN :** Why not?
- **IT :** Per quale motivo?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Mon suivi ne porte pas sur les exercices scolaires | My work does not focus on school exercises | Il mio intervento non riguarda gli esercizi scolastici |
| 2 | Je recommande des adaptations, mais je ne les conçois pas moi-même | I recommend adaptations but do not design them myself | Raccomando adattamenti, ma non li progetto io stesso/a |
| 3 | Manque de formation spécifique sur l'adaptation d'exercices | Lack of specific training in adapting exercises | Mancanza di formazione specifica sull'adattamento degli esercizi |
| 4 | Manque de lien avec l'école ou la structure de scolarisation des enfants | Lack of contact with the children's school or educational setting | Mancanza di contatti con la scuola o la struttura scolastica dei bambini |
| 5 | Manque de temps | Lack of time | Mancanza di tempo |
| 6 | Manque de ressources ou d'outils disponibles | Lack of available resources or tools | Mancanza di risorse o strumenti disponibili |
| 7 | Autre [+ texte libre] | Other [+ texte libre] | Altro [+ texte libre] |

#### `Q215` 

- QID FR QID215, IE QID365, UK QID509, IT QID653 ; choix multiples ; affichée seulement si `Q213` = 1 (Yes).
- **FR :** Sélectionnez tous les types d'adaptation que vous avez réalisées ou utilisées :
- **EN :** Select all the types of adaptation you have made or used:
- **IT :** Selezioni tutti i tipi di adattamento che ha realizzato o utilizzato:

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 14 | Exercices de math adaptés de manuels imprimés | Adapted maths exercises from printed textbooks | Adapted maths exercises from printed textbooks | Esercizi di matematica adattati da libri di testo cartacei |
| 15 | Exercices de français adaptés de manuels imprimés | Adapted English or Irish exercises from printed textbooks | Adapted English exercises from printed textbooks | Esercizi di italiano adattati da libri di testo cartacei |
| 16 | Exercices de math adaptés de manuels numériques | Adapted maths exercises from digital textbooks | Adapted maths exercises from digital textbooks | Esercizi di matematica adattati da libri di testo digitali |
| 17 | Exercices de français adaptés de manuels numériques | Adapted English or Irish exercises from digital textbooks | Adapted English exercises from digital textbooks | Esercizi di italiano adattati da libri di testo digitali |
| 18 | Adapter des exercices créés par les enseignants | Adapting exercises created by teachers | Adapting exercises created by teachers | Adattare esercizi creati dagli insegnanti |
| 19 | Adapter des exercices créés par les parents | Adapting exercises created by parents | Adapting exercises created by parents | Adattare esercizi creati dai genitori |
| 20 | Créer entièrement des exercices adaptés | Creating fully adapted exercises | Creating fully adapted exercises | Creare interamente esercizi adattati |
| 21 | Mettre en place des outils de compensation en plus de l'adaptation | Putting assistive / compensatory tools in place in addition to the adaptation | Putting assistive / compensatory tools in place in addition to the adaptation | Introdurre strumenti compensativi oltre all'adattamento |
| 22 | Former / sensibiliser l'enseignant et/ou la famille à l'adaptation | Training or raising awareness of the teacher and/or family about adaptation | Training or raising awareness of the teacher and/or family about adaptation | Formare / sensibilizzare l'insegnante e/o la famiglia all'adattamento |
| 23 | Autre : | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q216` 

- QID FR QID216, IE QID366, UK QID510, IT QID654 ; choix unique ; affichée seulement si `Q213` = 1 (Yes).
- **FR :** Globalement, comment évaluez vous l'efficacité de cette adaptation pour un enfant dyspraxique ?
- **EN :** Overall, how would you rate the effectiveness of this adaptation for a child with DCD/dyspraxia?
- **IT :** Nel complesso, come valuta l'efficacia di questo adattamento per un bambino con disprassia?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | 1 – Pas du tout efficace | 1 - Not effective | 1 - Per niente efficace |
| 2 | 2 – Plutot pas efficace | 2 - Slightly effective | 2 - Poco efficace |
| 3 | 3 – Neutre | 3 - Neutral | 3 - Neutro |
| 4 | 4 – Plutot efficace | 4 - Pretty effective | 4 - Abbastanza efficace |
| 5 | 5 – Très efficace | 5 - Very effective | 5 - Molto efficace |

#### `Q217` 

- QID FR QID217, IE QID367, UK QID511, IT QID655 ; liste déroulante ; affichée seulement si `Q213` = 1 (Yes).
- **FR :** Veuillez indiquer depuis combien d'année vous adaptez des exercices de manuels scolaires pour des enfants dyspraxiques.
- **EN :** Please indicate for how many years you have been adapting textbook exercises for children with DCD/dyspraxia.
- **IT :** Indichi da quanti anni adatta esercizi di libri di testo per bambini con disprassia.
- **Choix :** liste de 1 à 50+. Le code exporté est le nombre affiché (« 50+ » donne 50).

### Bloc démographique : jeunes adultes 18-25 ans (profil = 4)

Bloc Qualtrics « Adult Questions _FR » et ses équivalents `_IE`, `_UK`, `_IT`. Questions dans l'ordre d'affichage :

#### `Q218` 

- QID FR QID218, IE QID368, UK QID512, IT QID656 ; choix unique.
- **FR :** Quel est votre genre ?
- **EN :** What is your gender?
- **IT :** Qual è il Suo genere?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Femme | Woman | Donna |
| 2 | Homme | Man | Uomo |
| 3 | Non-binaire / autre identité de genre | Non-binary / other gender identity | Non binario / altra identità di genere |
| 4 | Je préfère me définir comme : [+ texte libre] | I prefer to self-describe as: [+ texte libre] | Preferisco descrivermi come: [+ texte libre] |
| 5 | Je préfère ne pas répondre | I prefer not to say | Preferisco non rispondere |

#### `Q219` 

- QID FR QID219, IE QID369, UK QID513, IT QID657 ; liste déroulante.
- **FR :** Quel âge avez-vous ?
- **EN :** How old are you?
- **IT :** Quanti anni ha?
- **Choix :** liste de 18 à 25. Le code exporté est le nombre affiché (« 25 » donne 25).

#### `Q220` 

- QID FR QID220, IE QID370, UK QID514, IT QID658 ; choix unique.
- **FR :** Quel est le diplôme le plus élevé que vous avez obtenu ?
- **EN :** What is the highest qualification you have obtained?
- **IT :** Qual è il titolo di studio più alto che ha conseguito?

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Scolarité interrompue sans diplôme | Left school with no qualifications | Left school with no qualifications | Nessun titolo di studio / licenza elementare |
| 2 | Brevet des collèges | Junior Certificate / Junior Cycle | GCSEs / O levels (or equivalent) | Licenza media |
| 3 | CAP, BEP, baccalauréat, brevet professionnel | Leaving Certificate, apprenticeship or QQI Level 5 award | A levels, BTEC, NVQ or apprenticeship (or equivalent) | Diploma di scuola secondaria di secondo grado o qualifica professionale |
| 4 | BTS, DUT, DEUST | Higher Certificate or QQI Level 6 award | Higher National Certificate / Diploma (HNC, HND) or foundation degree | Diploma di Istruzione Tecnica Superiore (ITS) |
| 5 | Licence | Bachelor's degree | Bachelor's degree | Laurea triennale |
| 6 | Master | Master's degree | Master's degree | Laurea magistrale o a ciclo unico |
| 7 | Doctorat | Doctorate (PhD) | Doctorate (PhD) | Dottorato di ricerca |
| 8 | Autre [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q221` 

- QID FR QID221, IE QID371, UK QID515, IT QID659 ; liste déroulante.
- **FR :** À quelle âge vos difficultés ont-elles commencé ?
- **EN :** At what age did your difficulties begin?
- **IT :** A che età sono iniziate le Sue difficoltà?
- **Choix :** liste de 3 à 25. Le code exporté est le nombre affiché (« 25 » donne 25).

#### `Q233` 

- QID FR QID233, IE QID372, UK QID516, IT QID660 ; liste déroulante.
- **FR :** À quelle âge avez vous reçu le diagnostique de dyspraxie ?
- **EN :** At what age were you diagnosed with DCD/dyspraxia?
- **IT :** A che età ha ricevuto la diagnosi di disprassia?
- **Choix :** liste de 3 à 25. Le code exporté est le nombre affiché (« 25 » donne 25). Choix supplémentaire en tête de liste, code 0 : FR « Je n'ai pas encore reçu de diagnostic » ; IE « I have not been diagnosed yet » ; UK « I have not been diagnosed yet » ; IT « Non ho ancora ricevuto una diagnosi ».

#### `Q222` 

- QID FR QID222, IE QID373, UK QID517, IT QID661 ; choix multiples.
- **FR :** Qui a posé votre diagnostique de dyspraxie ?
- **EN :** Who diagnosed your DCD/dyspraxia? (Tick all that apply)
- **IT :** Chi ha posto la Sua diagnosi di disprassia? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Un psychiatre | A psychiatrist | A psychiatrist | Un neuropsichiatra infantile |
| 2 | Un pédiatre | A paediatrician | A paediatrician | Un pediatra |
| 3 | Un psychologue (hypothèse de diagnostique) | A psychologist (suggested diagnosis) | A psychologist (suggested diagnosis) | Uno psicologo (ipotesi diagnostica) |
| 4 | Un psychomotricien (hypothèse de diagnostique) | A physiotherapist (suggested diagnosis) | A physiotherapist (suggested diagnosis) | Un terapista della neuro e psicomotricità dell'età evolutiva / TNPEE (ipotesi diagnostica) |
| 5 | Un ergothérapeute (hypothèse de diagnostique) | An occupational therapist (suggested diagnosis) | An occupational therapist (suggested diagnosis) | Un terapista occupazionale (ipotesi diagnostica) |
| 6 | Une équipe pluridisciplinaire | A multidisciplinary team (e.g. Children's Disability Network Team / CDNT) | A multidisciplinary team (e.g. Child Development Centre) | Un'équipe multidisciplinare (es. servizio di NPIA) |
| 7 | Personne | No one | No one | Nessuno |
| 8 | Diagnostique en cours | Diagnosis in progress | Diagnosis in progress | Diagnosi in corso |
| 9 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q223` 

- QID FR QID223, IE QID374, UK QID518, IT QID662 ; choix multiples.
- **FR :** Avez-vous reçu un diagnostique pour un ou plusieurs autres troubles ?
- **EN :** Have you been diagnosed with one or more other conditions? (Tick all that apply)
- **IT :** Ha ricevuto una diagnosi per uno o più altri disturbi? (Sono possibili più risposte)

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Aucun | None | Nessuno |
| 2 | Dyslexie | Dyslexia | Dislessia |
| 3 | Dyscalculie | Dyscalculia | Discalculia |
| 4 | TDA / TDAH | ADD / ADHD | ADHD (disturbo da deficit di attenzione/iperattività) |
| 5 | Autisme / Trouble du Spectre Autistique | Autism / autism spectrum disorder | Autismo / disturbo dello spettro autistico |
| 6 | Dysphasie | Developmental language disorder (DLD) | Disturbo del linguaggio |
| 7 | Autre : [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q224` 

- QID FR QID224, IE QID375, UK QID519, IT QID663 ; choix multiples.
- **FR :** Quelle école avez vous fréquenté ?
- **EN :** Which schools did you attend? (Tick all that apply)
- **IT :** Quali scuole ha frequentato? (Sono possibili più risposte)

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | École maternelle | Preschool / early years | Nursery / preschool | Scuola dell'infanzia |
| 2 | École primaire | Primary school | Primary school | Scuola primaria |
| 3 | Collège | Post-primary school (Junior Cycle) | Secondary school | Scuola secondaria di primo grado (scuola media) |
| 4 | Lycée | Post-primary school (Senior Cycle) | Sixth form or further education college | Scuola secondaria di secondo grado |
| 5 | Études supérieures | Further or higher education | Higher education (university) | Università / formazione superiore |
| 6 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q225` 

- QID FR QID225, IE QID376, UK QID520, IT QID664 ; choix multiples.
- **FR :** Veuillez sélectionner toutes les écoles, classes ou structures que vous avez fréquenté au cours de votre scolarité dans le primaire.
- **EN :** Please select all the schools, classes or settings you attended during primary school.
- **IT :** Selezioni tutte le scuole, classi o strutture che ha frequentato durante la scuola primaria.

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | École publique | Mainstream primary school (national school) | State-funded school (local authority maintained) | Scuola statale |
| 2 | École privée sous contrat | Gaelscoil / Irish-medium school | Academy or free school | Scuola paritaria |
| 3 | École privée hors contrat | Private (fee-paying) primary school | Independent (private) school | Scuola privata non paritaria |
| 4 | Classe Ulis | Special class in a mainstream school | Specialist unit or resource base within a mainstream school | Classe con il supporto di un insegnante di sostegno |
| 5 | École à la maison / CNED | Home education | Home education | Istruzione parentale (homeschooling) |
| 6 | Période de déscolarisation | Period(s) out of school | Period(s) out of school | Periodo/i di non frequenza scolastica |
| 7 | Scolarisation à la maison associative (type "Votre école chez vous") | School serving a socio-economically disadvantaged community (DEIS) | Alternative provision (e.g. hospital school or pupil referral unit) | Scuola in ospedale o istruzione domiciliare |
| 8 | Établissement médico-social (IME / ITEP / DITEP / IEM...) | Special school | Special school | Centro di riabilitazione o struttura socio-sanitaria con attività scolastica |
| 9 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q226` 

- QID FR QID226, IE QID377, UK QID521, IT QID665 ; choix unique.
- **FR :** Utilisiez-vous des manuels adaptés à l'école ?
- **EN :** Did you use adapted textbooks at school?
- **IT :** A scuola utilizzava libri di testo adattati?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | Oui | Yes | Sì |
| 2 | Non | No | No |

#### `Q227` 

- QID FR QID227, IE QID378, UK QID522, IT QID666 ; choix unique ; affichée seulement si `Q226` = 2 (Non).
- **FR :** Pour quelle raison ?
- **EN :** Why not?
- **IT :** Per quale motivo?

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 1 | Il n'y en avait pas | There were none | There were none | Non ce n'erano |
| 2 | Les adaptations proposées n'étaient pas efficace | The adaptations offered were not effective | The adaptations offered were not effective | Gli adattamenti proposti non erano efficaci |
| 3 | Je n'avais pas encore reçu le diagnostique de dyspraxie | I had not yet been diagnosed with DCD/dyspraxia | I had not yet been diagnosed with DCD/dyspraxia | Non avevo ancora ricevuto la diagnosi di disprassia |
| 4 | Le diagnostique n'a pas été suivi d'un plan d'accompagnement (PAP / PPS) | The diagnosis was not followed by a support plan (e.g. Student Support Plan or IEP) | The diagnosis was not followed by a support plan (e.g. EHC plan or SEN support plan) | Alla diagnosi non è seguito un piano di supporto (PDP o PEI) |
| 5 | J'ai préféré ne pas utiliser de manuels spécifiques | I preferred not to use specific textbooks | I preferred not to use specific textbooks | Ho preferito non utilizzare libri di testo specifici |
| 6 | Ma famille à refusé les adaptations ou n'a pas informé l'école des adaptations nécessaires | My family refused the adaptations or did not inform the school of the adaptations needed | My family refused the adaptations or did not inform the school of the adaptations needed | La mia famiglia ha rifiutato gli adattamenti o non ha informato la scuola degli adattamenti necessari |
| 7 | Autre : [+ texte libre] | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q228` 

- QID FR QID228, IE QID379, UK QID523, IT QID667 ; choix multiples ; affichée seulement si `Q226` = 1 (Oui).
- **FR :** Sélectionnez tous les types d'exercices adaptés que vous avez utilisé :
- **EN :** Select all the types of adapted exercises you used:
- **IT :** Selezioni tutti i tipi di esercizi adattati che ha utilizzato:

| Code | FR | IE | UK | IT |
|---|---|---|---|---|
| 13 | Exercices de math adaptés de manuels imprimés | Adapted maths exercises from printed textbooks | Adapted maths exercises from printed textbooks | Esercizi di matematica adattati da libri di testo cartacei |
| 14 | Exercices de français adaptés de manuels imprimés | Adapted English or Irish exercises from printed textbooks | Adapted English exercises from printed textbooks | Esercizi di italiano adattati da libri di testo cartacei |
| 15 | Exercices de math adaptés de manuels numériques | Adapted maths exercises from digital textbooks | Adapted maths exercises from digital textbooks | Esercizi di matematica adattati da libri di testo digitali |
| 16 | Exercices de français adaptés de manuels numériques | Adapted English or Irish exercises from digital textbooks | Adapted English exercises from digital textbooks | Esercizi di italiano adattati da libri di testo digitali |
| 17 | Des exercices adaptés par les enseignants | Exercises adapted by teachers | Exercises adapted by teachers | Esercizi adattati dagli insegnanti |
| 18 | Des exercices adaptés par les parents | Exercises adapted by parents | Exercises adapted by parents | Esercizi adattati dai genitori |
| 19 | Des exercices recommandés ou créés par des ergothérapeutes / des psychomotriciens | Exercises recommended or created by occupational therapists / physiotherapists | Exercises recommended or created by occupational therapists / physiotherapists | Esercizi consigliati o creati da terapisti (TNPEE o terapisti occupazionali) |
| 20 | Des manuels déjà adaptés disponibles à l'achat | Ready-made adapted textbooks available to buy | Ready-made adapted textbooks available to buy | Libri di testo già adattati disponibili in commercio |
| 21 | Autre : | Other: [+ texte libre] | Other: [+ texte libre] | Altro: [+ texte libre] |

#### `Q229` 

- QID FR QID229, IE QID380, UK QID524, IT QID668 ; choix unique ; affichée seulement si `Q226` = 1 (Oui).
- **FR :** Gobalement, comment évaluez-vous l'efficacité de ces adaptations pour votre apprentissage au primaire ?
- **EN :** Overall, how would you rate the effectiveness of these adaptations for your learning at primary school?
- **IT :** Nel complesso, come valuta l'efficacia di questi adattamenti per il Suo apprendimento alla scuola primaria?

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | 1 – Pas du tout efficace | 1 - Not effective | 1 - Per niente efficace |
| 2 | 2 – Plutot pas efficace | 2 - Slightly effective | 2 - Poco efficace |
| 3 | 3 – Neutre | 3 - Neutral | 3 - Neutro |
| 4 | 4 – Plutot efficace | 4 - Pretty effective | 4 - Abbastanza efficace |
| 5 | 5 – Très efficace | 5 - Very effective | 5 - Molto efficace |

### Pages de consigne

Deux pages de consigne, intégrées en iframe (sans réponse) : avant les exercices (`consignes/consigne_exercices_XX.html`, export `<pays>_Q323`) et avant les comparaisons (`consignes/consigne_comparaison_XX.html`, export `<pays>_Q319`). XX = FR, EN (pour IE et UK) ou IT.

- **consigne_exercices_FR :** Vous allez maintenant évaluer 16 courts exercices. Mettez-vous à la place d'un enfant dyspraxique. Regardez l'exercice d'origine. Faites l'exercice adapté et cliquez quand vous avez terminé. Évaluez l'efficacité de l'adaptation : globale ; motrice (écrire, cliquer) ; visuo-spatiale (se repérer). Pas de bonne ou de mauvaise réponse. Rassurez-vous, vos exercices seront en français. 2 Voici l'exercice d'origine 3 Voici l'exercice adapté 4 Voici à quoi ressemble l'évaluation
- **consigne_exercices_EN :** Now you will be asked to rate 16 short exercises. Put yourself in the shoes of a child with DCD. Look at the original exercise. Complete the adapted exercise and click when you are done. Rate how effective the adaptation was: overall; motor (writing, clicking); visual-spatial (finding your way). No right or wrong answers. Don't worry, your exercises will be in English. 2 This is the original exercise 3 This is the adapted exercise 4 This is what the rating looks like
- **consigne_exercices_IT :** Ora Le verrà chiesto di valutare 16 brevi esercizi. Si metta nei panni di un bambino con disprassia. Guardi l'esercizio originale. Completi l'esercizio adattato e clicchi quando ha finito. Valuti l'efficacia dell'adattamento: globale; motoria (scrivere, cliccare); visuo-spaziale (orientarsi). Nessuna risposta giusta o sbagliata. Non si preoccupi, i Suoi esercizi saranno in italiano. 2 Ecco l'esercizio originale 3 Ecco l'esercizio adattato 4 Ecco come si presenta la valutazione
- **consigne_exercices_demo_FR :** Démonstration en vidéo Cette courte vidéo montre les différentes étapes.
- **consigne_exercices_demo_EN :** See it in action This short video shows the steps involved.
- **consigne_exercices_demo_IT :** Guardi come funziona Questo breve video mostra le varie fasi.
- **consigne_comparaison_FR :** Comparer des adaptations Plusieurs paires de versions d'un même exercice. Toujours à la place d'un enfant dyspraxique, choisissez la plus efficace. Cliquez sur l'image choisie (cadre bleu), puis passez à la paire suivante. Pas de bonne ou de mauvaise réponse.
- **consigne_comparaison_EN :** Comparing adaptations Several pairs of versions of the same exercise. Still in the shoes of a child with DCD, choose the most effective one. Click on the image you choose (blue outline), then move on to the next pair. No right or wrong answers.
- **consigne_comparaison_IT :** Confrontare gli adattamenti Diverse coppie di versioni dello stesso esercizio. Sempre nei panni di un bambino con disprassia, scelga la più efficace. Clicchi sull'immagine scelta (cornice blu), poi passi alla coppia successiva. Nessuna risposta giusta o sbagliata.

### Exercices

Les 16 blocs d'exercices sont présentés dans un ordre aléatoire (randomiseur Qualtrics, 16 blocs sur 16, présentation équilibrée). Chaque bloc contient cinq éléments, dans cet ordre :

1. `<pays>_<bloc>_orig` : image de l'exercice d'origine, découpée dans le cahier d'exercices (pas de réponse).
2. `<pays>_<bloc>_done` : l'exercice adapté dans une iframe, avec une case unique à cocher (code 1) confirmant que l'exercice a été fait en entier.
3. `<pays>_<bloc>_overall` : note d'efficacité globale.
4. `<pays>_<bloc>_motor` : note d'efficacité motrice.
5. `<pays>_<bloc>_visuospatial` : note d'efficacité visuo-spatiale.

Textes des questions, identiques pour les 16 exercices :

- **`_done`, libellé de la case :** FR « Vous avez bien été au bout de l'exercice » ; EN « I completed the whole exercise » ; IT « Ho completato tutto l'esercizio ».
- **`_overall` :** FR « Globalement, comment évaluez vous l'efficacité de cette adaptation pour un enfant dyspraxique ? » ; EN « Overall, how effective is this adaptation for a child with DCD? » ; IT « Nel complesso, quanto è efficace questo adattamento per un bambino con disprassia? ».
- **`_motor` :** FR « Comment évaluez vous l'efficacité de cette adaptation d'un point de vue moteur ? » ; EN « How effective is this adaptation in reducing barriers related to motor demands? » ; IT « Quanto è efficace questo adattamento nel ridurre le difficoltà legate alle richieste motorie? ».
- **`_visuospatial` :** FR « Comment évaluez vous l'efficacité de cette adaptation d'un point de vue visuo-spatial ? » ; EN « How effective is this adaptation in reducing barriers related to visual-spatial demands? » ; IT « Quanto è efficace questo adattamento nel ridurre le difficoltà legate alle richieste visuo-spaziali? ».

Échelle des trois notes (code = chiffre) :

| Code | FR | EN | IT |
|---|---|---|---|
| 1 | 1 - Pas du tout efficace | 1 - Not effective | 1 - Per niente efficace |
| 2 | 2 - Plutôt pas efficace | 2 - Slightly effective | 2 - Poco efficace |
| 3 | 3 - Neutre | 3 - Neutral | 3 - Neutro |
| 4 | 4 - Plutôt efficace | 4 - Pretty effective | 4 - Abbastanza efficace |
| 5 | 5 - Très efficace | 5 - Very effective | 5 - Molto efficace |

Détail des 16 exercices (fichiers actuellement utilisés par le .qsf ; les images d'origine sont dans `images/originaux/<langue>/`) :

#### Exercice `RC` (exercice 12 des cahiers)

- **Noms d'export :** `<pays>_RC_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID238, QID237, QID234, QID235, QID236).
- **Fichiers de l'exercice adapté :** FR `RC.html` ; EN `RC_EN.html` ; IT `RC_IT.html`.
- **Consigne de l'exercice adapté :** FR « Complète la phrase avec un groupe nominal sujet. » ; EN « Complete the sentence with a subject by using a noun phrase. » ; IT « Completa la frase con un soggetto. ».
- **Exercice d'origine (FR) :** « Complète la phrase avec un groupe nominal sujet. » 1. ............ se leva précipitamment. / 2. Dès la tombée de la nuit, ............ illuminent le ciel. / 3. ............ lui donne une fière allure.
- **Exercice d'origine (EN) :** « Complete the following sentences with a subject by using a noun phrase. » 1. ............ stood up hastily. / 2. As soon as the night falls, ............ shine in the sky. / 3. ............ makes him look good.
- **Exercice d'origine (IT) :** « Completa ogni frase con un soggetto. » 1. ............ si alzò di scatto. / 2. Al calar della notte, ............ illuminano il cielo. / 3. ............ gli dà un'aria fiera.

#### Exercice `TransformeMot` (exercice 15 des cahiers)

- **Noms d'export :** `<pays>_TransformeMot_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID239, QID240, QID241, QID242, QID243).
- **Fichiers de l'exercice adapté :** FR `TransformeMot.html` ; EN `TransformeMot_EN.html` ; IT `TransformeMot_IT.html`.
- **Consigne de l'exercice adapté :** FR « Écris ces verbes au passé composé. » ; EN « Write these verbs in the past tense. » ; IT « Scrivi questi verbi al passato prossimo. ».
- **Exercice d'origine (FR) :** « Écris ces verbes au passé composé. » a. tu vois • nous lisons • il vient / b. elles disent • vous prenez • tu chantes
- **Exercice d'origine (EN) :** « Write these verbs in the past tense. » a. you see • we read • he comes / b. they say • she takes • you sing
- **Exercice d'origine (IT) :** « Scrivi questi verbi al passato prossimo. » a. tu vedi • noi leggiamo • lui viene / b. loro dicono • voi prendete • tu canti

#### Exercice `CocheGroupeMot` (exercice 8 des cahiers)

- **Noms d'export :** `<pays>_CocheGroupeMot_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID244, QID245, QID246, QID247, QID248).
- **Fichiers de l'exercice adapté :** FR `CocheGroupeMots.html` ; EN `CocheGroupeMots_EN.html` ; IT `CocheGroupeMots_IT.html`.
- **Consigne de l'exercice adapté :** FR « Clique sur les groupes nominaux au singulier. » ; EN « Click on the nouns which are in a singular form. » ; IT « Clicca sui nomi al singolare. ».
- **Exercice d'origine (FR) :** « Recopie uniquement les groupes nominaux au singulier. » un orage • l'averse • des giboulées • le mistral • une canicule • / les nuages • le déluge • la bruine
- **Exercice d'origine (EN) :** « Write down the nouns which are in a singular form. » storm • showers • downpours • wind • heatwave • clouds • torrential rain • mist
- **Exercice d'origine (IT) :** « Ricopia solo i nomi al singolare. » un temporale • l'acquazzone • delle raffiche • il maestrale • una grandinata • le / nuvole • il diluvio • la pioggerella

#### Exercice `CochePhrase` (exercice 11 des cahiers)

- **Noms d'export :** `<pays>_CochePhrase_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID249, QID250, QID251, QID252, QID253).
- **Fichiers de l'exercice adapté :** FR `CochePhrase.html` ; EN `CochePhrase_EN.html` ; IT `CochePhrase_IT.html`.
- **Consigne de l'exercice adapté :** FR « Clique sur les phrases au pluriel. » ; EN « Click on the sentences which are in a plural form. » ; IT « Clicca sulle frasi al plurale. ».
- **Exercice d'origine (FR) :** « Recopie seulement les phrases qui sont au pluriel. » C'est l'hiver : les jours raccourcissent. / Les flammes crépitent dans la cheminée de leur salon. / Mon petit cousin a le nez tout rouge. / C'est l'hiver : la nuit dure longtemps.
- **Exercice d'origine (EN) :** « Write down the sentences which are in a plural form. » It is winter: the days get shorter. / The flames are crackling in the fire in their sitting room. / My little cousin’s nose is all red. / It is winter: the night lasts longer.
- **Exercice d'origine (IT) :** « Ricopia solo le frasi che sono al plurale. » È inverno: le giornate si accorciano. / Le fiamme scoppiettano nel camino del loro salotto. / Il mio piccolo cugino ha il naso tutto rosso. / È inverno: la notte dura a lungo.

#### Exercice `CacheIntrus` (exercice 13 des cahiers)

- **Noms d'export :** `<pays>_CacheIntrus_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID254, QID255, QID256, QID257, QID258).
- **Fichiers de l'exercice adapté :** FR `CacheIntrus.html` ; EN `CacheIntrus_EN.html` ; IT `CacheIntrus_IT.html`.
- **Consigne de l'exercice adapté :** FR « Dans chaque liste, clique sur l'intrus pour le cacher. » ; EN « In each list, click on the odd one out to hide it. » ; IT « In ogni elenco, clicca sull'intruso per nasconderlo. ».
- **Exercice d'origine (FR) :** « Recopie chaque liste sans l'intrus. » a. vite • petites • encore • hier / b. déjà • manger • aussi • parfois / c. chaise • avec • sans • dans / d. et • ou • mais • pendant
- **Exercice d'origine (EN) :** « Copy down each list without the odd one out. » a. quickly • small • again • soon / b. already • to eat • also • sometimes / c. chair • with • without • in / d. and • or • but • this
- **Exercice d'origine (IT) :** « Ricopia ogni elenco senza l'intruso. » a. presto • piccole • ancora • ieri / b. già • mangiare • anche • talvolta / c. sedia • con • senza • in / d. e • o • ma • durante

#### Exercice `EditePhrase` (exercice 14 des cahiers)

- **Noms d'export :** `<pays>_EditePhrase_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID259, QID260, QID261, QID262, QID263).
- **Fichiers de l'exercice adapté :** FR `EditPhrase.html` ; EN `EditPhrase_EN.html` ; IT `EditPhrase_IT.html`.
- **Consigne de l'exercice adapté :** FR « Modifie la phrase en ajoutant la majuscule et le point. » ; EN « Correct the sentence by adding capital letters and a full stop. » ; IT « Modifica la frase aggiungendo la maiuscola e il punto. ».
- **Exercice d'origine (FR) :** « Recopie les phrases en mettant les majuscules et les points. » le roi n'en croit pas ses yeux / le chat parle et personne ne s'étonne / les enfants caressent la tête de l'animal / nous prenons une photographie avec le chat botté
- **Exercice d'origine (EN) :** « Read these sentences. Write each one out correctly with a full stop and capital letters in the right place. » the king can’t believe his eyes / the cat speaks and nobody is surprised / the children pet the animal’s head / we take a photo with puss in boots
- **Exercice d'origine (IT) :** « Ricopia le frasi mettendo le maiuscole e i punti. » il re non crede ai suoi occhi / il gatto parla e nessuno si stupisce / i bambini accarezzano la testa dell'animale / noi scattiamo una fotografia con il gatto con gli stivali

#### Exercice `Classe` (exercice 7 des cahiers)

- **Noms d'export :** `<pays>_Classe_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID264, QID265, QID266, QID267, QID268).
- **Fichiers de l'exercice adapté :** FR `Classe.html` ; EN `Classe_EN.html` ; IT `Classe_IT.html`.
- **Consigne de l'exercice adapté :** FR « Colorie les groupes nominaux pour les classer: singulier 1 clic = jaune pluriel 2 clics = rose » ; EN « Colour the nouns to sort them: singular 1 click = yellow plural 2 clicks = pink » ; IT « Colora i nomi per classificarli: singolare 1 clic = giallo plurale 2 clic = rosa ».
- **Exercice d'origine (FR) :** « Classe les groupes nominaux dans le tableau. » Singulier   Pluriel / un horaire • vos tickets • la voyageuse • mes bagages • des rails • / une gare • cette place • ces transports
- **Exercice d'origine (EN) :** « Place the nouns below in the correct column. » Singular   Plural / timetable • tickets • passenger • suitcases • tracks • train station • seat • / public transport
- **Exercice d'origine (IT) :** « Classifica i nomi nella tabella. » Singolare   Plurale / un orario • i vostri biglietti • la viaggiatrice • i miei bagagli • dei binari • una / stazione • questo posto • questi trasporti

#### Exercice `Associe` (exercice 9 des cahiers)

- **Noms d'export :** `<pays>_Associe_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID269, QID270, QID271, QID272, QID273).
- **Fichiers de l'exercice adapté :** FR `associe_colonne_noms.html` ; EN `associe_colonne_noms_EN.html` ; IT `associe_colonne_noms_IT.html`.
- **Consigne de l'exercice adapté :** FR « Associe chaque nom commun à un nom propre. » ; EN « Match each common noun to a proper noun. » ; IT « Associa ogni nome comune a un nome proprio. ».
- **Exercice d'origine (FR) :** « Associe chaque nom commun à un nom propre. » un roi   •   •   Lille / un peintre   •   •   Louis XVI / une ville   •   •   la Seine / un fleuve   •   •   Espagne / un pays   •   •   Picasso
- **Exercice d'origine (EN) :** « Match each common noun to a proper noun. » a king   •   •   Belfast / a painter   •   •   Brian Boru / a city   •   •   Liffey / a river   •   •   Spain / a country   •   •   Picasso
- **Exercice d'origine (IT) :** « Associa ogni nome comune a un nome proprio. » un re   •   •   Torino / un pittore   •   •   Romolo / una città   •   •   il Po / un fiume   •   •   Spagna / uno Stato   •   •   Leonardo

#### Exercice `RCDouble` (exercice 16 des cahiers)

- **Noms d'export :** `<pays>_RCDouble_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID274, QID275, QID276, QID277, QID278).
- **Fichiers de l'exercice adapté :** FR `RCDouble.html` ; EN `RCDouble_EN.html` ; IT `RCDouble_IT.html`.
- **Consigne de l'exercice adapté :** FR « Transforme ces phrases en remplaçant les mots coloriés par leur antonyme. » ; EN « Replace the coloured words with a word of the opposite meaning. » ; IT « Trasforma queste frasi sostituendo le parole colorate con il loro contrario. ».
- **Exercice d'origine (FR) :** « Transforme ces phrases en remplaçant les mots en gras par leur antonyme. » a. Ce sac est très lourd. / b. Cette rue est très étroite. / c. Sa chambre est toujours propre. / d. Mon voisin est très jeune.
- **Exercice d'origine (EN) :** « Replace the words in bold with a word of the opposite meaning. » a. This bag is very heavy. / b. This street is very narrow. / c. His bedroom is always clean. / d. My neighbour is very young.
- **Exercice d'origine (IT) :** « Trasforma le frasi sostituendo le parole in grassetto con il loro contrario. » a. Questa borsa è molto pesante. / b. Questa strada è molto stretta. / c. La sua camera è sempre pulita. / d. Il mio vicino è molto giovane.

#### Exercice `CliqueEcrire` (exercice 10 des cahiers)

- **Noms d'export :** `<pays>_CliqueEcrire_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID279, QID280, QID281, QID282, QID283).
- **Fichiers de l'exercice adapté :** FR `CliqueEcrire_1.html` ; EN `CliqueEcrire_1_EN.html` ; IT `CliqueEcrire_1_IT.html`.
- **Consigne de l'exercice adapté :** FR « Clique sur les noms communs singuliers. » ; EN « Click on the common nouns in a singular form. » ; IT « Clicca sui nomi comuni al singolare. ».
- **Exercice d'origine (FR) :** « Recopie uniquement les noms communs singulier. » Indique leur pluriel. / Léo se promène avec son chien. Il voit un château au loin. Un lapin traverse / rapidement. Soudain, un enfant arrive en courant. Il trouve un œuf caché. Plus / loin, un cheval broute calmement. Les oiseaux chantent joyeusement. Léo / rentre content.
- **Exercice d'origine (EN) :** « Only copy down common nouns in a singular form. » Then, write them in their plural form. / Leo is going for a walk with his dog. He sees a castle far away. A mouse / crosses the path quickly. Suddenly, a child comes running. He finds a hidden / egg. Further away, a horse is grazing calmly. Birds are singing merrily. Leo / comes home feeling happy.
- **Exercice d'origine (IT) :** « Ricopia solo i nomi comuni al singolare. » Scrivi il loro plurale. / Leo passeggia con il suo cane. Vede un lago in lontananza. Un coniglio / attraversa velocemente. All'improvviso, un bambino arriva correndo. Trova un / uovo nascosto. Più in là, un cavallo bruca tranquillamente. Gli uccelli cantano / allegramente. Leo torna a casa contento.

#### Exercice `EcritureNombres` (exercice 3 des cahiers)

- **Noms d'export :** `<pays>_EcritureNombres_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID284, QID285, QID286, QID287, QID288).
- **Fichiers de l'exercice adapté :** FR `EcritureNombres.html` ; EN `EcritureNombres_EN.html` ; IT `EcritureNombres_IT.html`.
- **Consigne de l'exercice adapté :** FR « Écris les nombres en chiffres. » ; EN « Write these numbers in digits. » ; IT « Scrivi i numeri in cifre. ».
- **Exercice d'origine (FR) :** « Écris les nombres en chiffres. » cent-huit   neuf-cent-trois   deux-cent-soixante / cent-soixante-dix   sept-cent-vingt
- **Exercice d'origine (EN) :** « Write these numbers in digit form. » one hundred and eight   nine hundred and three   two hundred and sixty / one hundred and seventy-six   seven hundred and twenty
- **Exercice d'origine (IT) :** « Scrivi i numeri in cifre. » centotto   novecentotré   duecentosessanta / centosettanta   settecentoventi

#### Exercice `Comptage` (exercice 2 des cahiers)

- **Noms d'export :** `<pays>_Comptage_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID289, QID290, QID291, QID292, QID293).
- **Fichiers de l'exercice adapté :** FR `Comptage.html` ; EN `Comptage_EN.html` ; IT `Comptage_IT.html`.
- **Consigne de l'exercice adapté :** FR « Compte les voitures et écris le bon nombre. » ; EN « Count the cars and write the correct number. » ; IT « Conta le macchine e scrivi il numero giusto. ».
- **Exercice d'origine (FR) :** « Compte les voitures et écris ta réponse en chiffres. » Il y a … voitures.
- **Exercice d'origine (EN) :** « Count the cars and write the total number in digits in the sentence below. » There are … cars.
- **Exercice d'origine (IT) :** « Conta le macchine e scrivi la risposta in cifre. » Ci sono … macchine.

#### Exercice `Decomposition` (exercice 5 des cahiers)

- **Noms d'export :** `<pays>_Decomposition_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID294, QID295, QID296, QID297, QID298).
- **Fichiers de l'exercice adapté :** FR `Decomposition.html` ; EN `Decomposition_EN.html` ; IT `Decomposition_IT.html`.
- **Consigne de l'exercice adapté :** FR « Décompose chaque nombre comme dans l'exemple. 394 = (3 x 100) + (9 x 10) + 4 » ; EN « Break down each number as per the example. 394 = (3 x 100) + (9 x 10) + 4 » ; IT « Scomponi ogni numero come nell'esempio. 394 = (3 x 100) + (9 x 10) + 4 ».
- **Exercice d'origine (FR) :** « Décompose chaque nombre comme dans l'exemple. » 394 = (3 x 100) + (9 x 10) + 4 / a. 428 = / b. 203 = / c. 750 =
- **Exercice d'origine (EN) :** « Break down each number as per the example. » 394 = (3 x 100) + (9 x 10) + 4 / a. 428 = / b. 203 = / c. 750 =
- **Exercice d'origine (IT) :** « Scomponi ogni numero come nell'esempio. » 394 = (3 x 100) + (9 x 10) + 4 / a. 428 = / b. 203 = / c. 750 =

#### Exercice `CM_Math` (exercice 4 des cahiers)

- **Noms d'export :** `<pays>_CM_Math_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID299, QID300, QID301, QID302, QID303).
- **Fichiers de l'exercice adapté :** FR `CM_Math.html` ; EN `CM_Math_EN.html` ; IT `CM_Math_IT.html`.
- **Consigne de l'exercice adapté :** FR « Complète avec < ou > . » ; EN « Complete with < or > . » ; IT « Completa con < o > . ».
- **Exercice d'origine (FR) :** « Complète avec < ou > . » a. 329 ... 146 / b. 279 ... 289 / c. 738 ... 734 / d. 106 ... 160
- **Exercice d'origine (EN) :** « Put the correct symbol (< or >) between these numbers. » a. 329 ... 146 / b. 279 ... 289 / c. 738 ... 734 / d. 106 ... 160
- **Exercice d'origine (IT) :** « Completa con < o >. » a. 329 ... 146 / b. 279 ... 289 / c. 738 ... 734 / d. 106 ... 160

#### Exercice `AdditionsPosees` (exercice 6 des cahiers)

- **Noms d'export :** `<pays>_AdditionsPosees_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID304, QID305, QID306, QID307, QID308).
- **Fichiers de l'exercice adapté :** FR `AdditionsPosees.html` ; EN `AdditionsPosees_EN.html` ; IT `AdditionsPosees_IT.html`.
- **Consigne de l'exercice adapté :** FR « Pose et effectue l'addition. » ; EN « Calculate each sum using column addition. » ; IT « Metti in colonna ed esegui l'addizione. ».
- **Exercice d'origine (FR) :** « Pose et effectue l'addition. » a. 158 + 331 / b. 321 + 57
- **Exercice d'origine (EN) :** « Calculate each sum using column addition. » a. 158 + 331 / b. 321 + 57
- **Exercice d'origine (IT) :** « Metti in colonna ed esegui le addizioni. » a. 158 + 331 / b. 321 + 57

#### Exercice `GroupeEchange` (exercice 1 des cahiers)

- **Noms d'export :** `<pays>_GroupeEchange_orig`, `_done`, `_overall`, `_motor`, `_visuospatial` (QID FR QID309, QID310, QID311, QID312, QID313).
- **Fichiers de l'exercice adapté :** FR `GroupeEchange.html` ; EN `GroupeEchange_EN.html` ; IT `GroupeEchange_IT.html`.
- **Consigne de l'exercice adapté :** FR « Range les nombres dans l'ordre de 11 à 15. » ; EN « Put the numbers in order from 11 to 15. » ; IT « Metti in ordine i numeri da 11 a 15. ».
- **Exercice d'origine (FR) :** « Relie les nombres du plus petit au plus grand. » 13   12 / 15 / 11 / 14
- **Exercice d'origine (EN) :** « Connect the following numbers from the smallest to the largest. » 13   12 / 15 / 11 / 14
- **Exercice d'origine (IT) :** « Collega i numeri dal più piccolo al più grande. » 13   12 / 15 / 11 / 14

### Comparaisons

Le bloc de comparaisons présente 5 questions dans un ordre aléatoire, une par page. Chaque question montre deux captures du même exercice, adapté de deux façons, côte à côte et dans un ordre aléatoire. Le participant clique sur celle qu'il préfère.

#### `inegalite`

- QID FR QID98, IE QID463, UK QID607, IT QID751 ; choix unique entre deux images.
- **Question :** FR « Quelle adaptation préférez-vous ? » ; EN « Which adaptation do you prefer? » ; IT « Quale adattamento preferisce? ».

| Code numérique | Code texte | Image (dans `images/comparaisons/<langue>/`) | Exercice capturé |
|---|---|---|---|
| 1 | `semantique` | `inegalite_semantique.png` | `inegalite_semantique` (+ `_EN`, `_IT`) |
| 2 | `symbole` | `inegalite_signe.png` | `inegalite_signe` (+ `_EN`, `_IT`) |

#### `CM_carre_colonne`

- QID FR QID103, IE QID464, UK QID608, IT QID752 ; choix unique entre deux images.
- **Question :** FR « Quelle adaptation préférez-vous ? » ; EN « Which adaptation do you prefer? » ; IT « Quale adattamento preferisce? ».

| Code numérique | Code texte | Image (dans `images/comparaisons/<langue>/`) | Exercice capturé |
|---|---|---|---|
| 1 | `carre` | `CM_carre.png` | `associe_carre` (+ `_EN`, `_IT`) |
| 2 | `colonne` | `CM_colonne.png` | `associe_colonne` (+ `_EN`, `_IT`) |

#### `Coche_cadre_colonne`

- QID FR QID315, IE QID465, UK QID609, IT QID753 ; choix unique entre deux images.
- **Question :** FR « Quelle adaptation préférez-vous ? » ; EN « Which adaptation do you prefer? » ; IT « Quale adattamento preferisce? ».

| Code numérique | Code texte | Image (dans `images/comparaisons/<langue>/`) | Exercice capturé |
|---|---|---|---|
| 1 | `cadre` | `coche_cadre.png` | `cochegroupemots_cadre` (+ `_EN`, `_IT`) |
| 2 | `colonne` | `coche_colonne.png` | `cochegroupemots_colonne` (+ `_EN`, `_IT`) |

#### `coche_ligne_cadre`

- QID FR QID316, IE QID466, UK QID610, IT QID754 ; choix unique entre deux images.
- **Question :** FR « Quelle adaptation préférez-vous ? » ; EN « Which adaptation do you prefer? » ; IT « Quale adattamento preferisce? ».

| Code numérique | Code texte | Image (dans `images/comparaisons/<langue>/`) | Exercice capturé |
|---|---|---|---|
| 1 | `cadre` | `coche_cadre.png` | `cochegroupemots_cadre` (+ `_EN`, `_IT`) |
| 3 | `ligne` | `coche_ligne.png` | `cochegroupemots_ligne` (+ `_EN`, `_IT`) |

#### `coche_ligne_colonne`

- QID FR QID317, IE QID467, UK QID611, IT QID755 ; choix unique entre deux images.
- **Question :** FR « Quelle adaptation préférez-vous ? » ; EN « Which adaptation do you prefer? » ; IT « Quale adattamento preferisce? ».

| Code numérique | Code texte | Image (dans `images/comparaisons/<langue>/`) | Exercice capturé |
|---|---|---|---|
| 2 | `colonne` | `coche_colonne.png` | `cochegroupemots_colonne` (+ `_EN`, `_IT`) |
| 3 | `ligne` | `coche_ligne.png` | `cochegroupemots_ligne` (+ `_EN`, `_IT`) |

Consignes des exercices capturés :

- **inegalite_semantique :** FR « Pour chaque paire, indique si le premier est "plus grand que" ou "plus petit que" le deuxième. » ; EN « For each pair, say whether the first number is "greater than" or "less than" the second. » ; IT « Per ogni coppia, indica se il primo è "più grande di" o "più piccolo di" il secondo. ».
- **inegalite_signe :** FR « Pour chaque paire, sélectionne le signe < ou >. » ; EN « For each pair, select the sign < or >. » ; IT « Per ogni coppia, seleziona il segno < o >. ».
- **CM_carre :** FR « choisi le bon verbe pour completer la phrase parmis : participons - as - marche - allez - déménagent » ; EN « Choose the correct verb to complete the sentence from: am taking part - have - walks - am going - are moving » ; IT « Scegli il verbo giusto per completare la frase tra: partecipiamo - hai - cammina - andate - traslocano ».
- **CM_colonne :** FR « Choisis le bon verbe pour compléter la phrase. » ; EN « Choose the correct verb to complete the sentence. » ; IT « Scegli il verbo giusto per completare la frase. ».
- **coche_cadre :** FR « Colorie uniquement les groupes nominaux au singulier. » ; EN « Only colour the nouns which are in a singular form. » ; IT « Colora solo i nomi al singolare. ».
- **coche_colonne :** FR « Colorie uniquement les groupes nominaux au singulier. » ; EN « Only colour the nouns which are in a singular form. » ; IT « Colora solo i nomi al singolare. ».
- **coche_ligne :** FR « Colorie uniquement les groupes nominaux au singulier. » ; EN « Only colour the nouns which are in a singular form. » ; IT « Colora solo i nomi al singolare. ».

Particularités des captures :
- **Associe et inégalités :** capturés à l'item b, avec le menu de choix ouvert. Associe montre les verbes en grille (carré) ou en liste verticale (colonne). Les inégalités montrent les choix en mots (sémantique) ou en signes < et > (symbole).
- **Coche :** état initial. Les groupes de mots sont encadrés (cadre), un par ligne (colonne), ou à la suite sur une ligne avec des tirets (ligne).
- **CM carré :** capturé avec la consigne courte de `associe_colonne`, et non celle de `associe_carre` qui liste les verbes.
