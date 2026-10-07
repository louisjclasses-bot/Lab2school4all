# Questionnaire Lab2School4All : résumé

**Fichier :** `qualtrics/Lab2School4All_6.qsf` (à importer dans Qualtrics)

## Objet

Recueillir l'avis de différents publics sur des exercices de manuels scolaires adaptés pour les enfants dyspraxiques (TDC / DCD). Les répondants testent chaque exercice adapté, puis l'évaluent. Le projet Lab2School4All est financé par l'Union européenne (Horizon Europe) et a reçu l'avis favorable du comité d'éthique de l'University of Limerick.

## Quatre pays, quatre branches identiques

La première question demande le pays. Elle oriente vers une branche complète, dans la langue du pays :

| Pays | Langue | Exercices utilisés |
|---|---|---|
| Irlande | anglais | fichiers `_EN` |
| Royaume-Uni | anglais | fichiers `_EN` |
| France | français | fichiers d'origine |
| Italie | italien | fichiers `_IT` |

Les quatre branches ont la même structure. Seules les listes propres à chaque pays changent : diplômes, types d'écoles, professionnels, plans d'accompagnement.

## Déroulé d'une branche

1. **Introduction**
   - Lien vers la fiche d'information.
   - Formulaire de consentement : un refus mène à la fin du questionnaire.
   - Accord facultatif pour être recontacté (e-mail).
2. **Profil du répondant** : un choix parmi quatre groupes.
3. **Questions démographiques** propres au groupe choisi :
   - **Parents d'un enfant dyspraxique** (16 questions) : profil du parent, âge et genre de l'enfant, diagnostic et troubles associés, scolarité, usage d'exercices adaptés et efficacité perçue.
   - **Enseignants du primaire** (13 questions) : profil, expérience, lieux d'exercice, adaptation d'exercices (raisons, types, efficacité, années d'expérience).
   - **Professionnels de santé** (ergothérapeutes, psychomotriciens ou équivalents, 11 questions) : profil, structures, intervention à l'école, adaptation d'exercices.
   - **Jeunes adultes dyspraxiques de 18 à 25 ans** (13 questions) : profil, diagnostic, scolarité, manuels adaptés utilisés et efficacité perçue.
4. **Consigne des exercices**, avec une animation de démonstration.
5. **16 exercices adaptés, dans un ordre aléatoire.** Pour chacun :
   - l'exercice d'origine du manuel (image) ;
   - l'exercice adapté, à faire en entier, puis la case « J'ai bien été au bout de l'exercice » ;
   - trois notes de 1 (pas du tout efficace) à 5 (très efficace) : efficacité globale, motrice et visuo-spatiale.

   Exercices : RC, TransformeMot, CocheGroupeMots, CochePhrase, CacheIntrus, EditPhrase, Classe, Associe, RCDouble, CliqueEcrire, EcritureNombres, Comptage, Decomposition, CM_Math, AdditionsPosees, GroupeEchange.
6. **Consigne des comparaisons.**
7. **5 comparaisons, dans un ordre aléatoire.** Deux versions d'un même exercice sont présentées côte à côte et le répondant clique sur celle qu'il préfère. Paires comparées :
   - inégalités ;
   - CM carré / colonne ;
   - coche cadre / colonne ;
   - coche ligne / cadre ;
   - coche ligne / colonne.

## Données exportées

Chaque variable porte le préfixe de son pays : `FR_`, `IE_`, `UK_` ou `IT_`. Seule la question du pays garde son nom, `Q33`. Le reste du nom est identique d'un pays à l'autre, ce qui permet de fusionner les quatre pays :

- questions démographiques : `FR_Q176`, `IE_Q176`, `UK_Q176`, `IT_Q176` désignent la même question (âge du parent) ;
- exercices : `<pays>_<exercice>_orig` (image), `_done` (case « au bout de l'exercice »), `_overall`, `_motor`, `_visuospatial` (notes de 1 à 5) ;
- comparaisons : `<pays>_inegalite`, `<pays>_CM_carre_colonne`, `<pays>_Coche_cadre_colonne`, `<pays>_coche_ligne_cadre`, `<pays>_coche_ligne_colonne` ;
- choix « Autre » : colonne supplémentaire `..._TEXT` avec le texte saisi.

Pour que tout soit identifiable dans le CSV :
- aucun nom de variable n'est en double ;
- aucun libellé de choix multiple ne contient de virgule, puisque Qualtrics sépare les réponses multiples par des virgules ;
- les listes déroulantes (âges, années) exportent la valeur affichée : 18 pour « 18 », 70 pour « 70+ », et 0 pour « pas encore de diagnostic » ;
- les anciens blocs anglais (hors flux) ont été mis dans la corbeille de Qualtrics, d'où ils restent restaurables.

## Codage des comparaisons

Chaque image de comparaison porte un code, identique dans les quatre pays. On sait donc toujours quelle adaptation a été choisie, quel que soit l'ordre d'affichage (aléatoire). En export « texte des choix », le CSV contient directement le mot (masqué à l'écran pour les participants) ; en export « valeurs numériques », il contient le chiffre :

| Comparaison | Texte | Nombre |
|---|---|---|
| Inégalités | `semantique` / `symbole` | 1 / 2 |
| CM | `carre` / `colonne` | 1 / 2 |
| Coche (3 paires) | `cadre` / `colonne` / `ligne` | 1 / 2 / 3 |

Pour les « coche », le code d'une version est le même dans les trois paires : `ligne` vaut toujours 3, par exemple.

## Réponses obligatoires

Toutes les questions des quatre branches sont obligatoires. Pour l'âge au diagnostic des jeunes adultes, la réponse « pas encore de diagnostic » a été ajoutée, comme dans la question des parents.

## Images

Les captures des exercices d'origine (découpées dans les cahiers d'exercices FR, EN et IT) et les captures des comparaisons sont hébergées sur GitHub Pages, dans `images/originaux/` et `images/comparaisons/`. Les branches Irlande, Royaume-Uni et Italie y renvoient directement, sans passer par la bibliothèque Qualtrics. La branche France garde ses images Qualtrics pour les exercices d'origine, mais utilise désormais les captures GitHub pour les comparaisons, afin que chaque image ait un code connu.

## Reste à finaliser

- **Publication :** les images, les nouveaux exercices « coche » et le consentement italien ne s'afficheront qu'une fois la branche fusionnée sur la branche principale (GitHub Pages).
- **Italie, fiche d'information :** la fiche n'existe pas en italien. La branche renvoie pour l'instant vers la fiche anglaise.
- **Italie, consentement :** le formulaire (`consent-form-tricolore_IT.html`) est à faire relire par l'équipe italienne.
- **Question de recontact :** les focus groups ne sont précisés que pour la France (Île-de-France, février et mars 2027).
