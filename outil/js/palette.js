// Palette de 12 pas (vert -> écarlate). Voir docs/PALETTE.md (contrastes et daltonismes mesurés).
// Pas 1..12 = case (facile..impossible) x zone (gauche, centre, droite).
export const PALETTE = [
  "#49df6e", "#6cd043", "#86bf07", "#9dab05", "#aa9906", "#b08700",
  "#b37603", "#b46403", "#b45101", "#b53a00", "#b02302", "#a70311"
];
const mix = (hex, k) => {           // mélange avec du blanc : k = part de couleur
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return "#" + c.map(v => Math.round(255 - (255 - v) * k).toString(16).padStart(2, "0")).join("");
};
export const FOND_K = 0.15;
export const bord = pas => PALETTE[pas - 1];
export const fond = pas => mix(PALETTE[pas - 1], FOND_K);
export const pasCentre = caseIdx => caseIdx * 3 + 2;   // pas de la zone centre d'une case
