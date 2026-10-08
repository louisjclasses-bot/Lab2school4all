# Guide animateur

Support imprimable pour les sessions de formation à l'adaptation d'exercices.

- `guide_animateur.pdf` : une page A4 par exercice (16 pages). Chaque page est découpée en trois bandes (FR, EN, IT) ; dans chaque bande, l'exercice adapté est à gauche et l'exercice d'origine du manuel à droite.
- `captures/FR`, `captures/EN`, `captures/IT` : premier écran de chaque exercice adapté, nommé comme l'image d'origine correspondante dans `images/originaux/`.
- `generer_guide.js` : refait les captures et le PDF. Les exercices et leurs fichiers sont ceux du questionnaire Qualtrics.
- `recadrer.py` : recadrage des captures, appelé par `generer_guide.js`.

## Regénérer

Depuis la racine du dépôt (Playwright avec Chromium, Python 3 avec Pillow) :

```
node guide_animateur/generer_guide.js          # captures + PDF
node guide_animateur/generer_guide.js --pdf    # PDF seul, à partir des captures existantes
```

Pour changer un titre ou l'ordre des pages, modifier la liste `EXERCICES` en haut de `generer_guide.js`.
