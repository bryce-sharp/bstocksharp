import { Alfa_Slab_One, Anton, Archivo_Black, Courier_Prime, Cutive_Mono, Xanh_Mono } from "next/font/google";
import { DISPLAY, TYPE } from "../fonts";

const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--rts-art-courier" });
const cutive = Cutive_Mono({ subsets: ["latin"], weight: "400", display: "swap", variable: "--rts-art-cutive" });
const xanh = Xanh_Mono({ subsets: ["latin"], weight: "400", display: "swap", variable: "--rts-art-xanh" });
const alfa = Alfa_Slab_One({ subsets: ["latin"], weight: "400", display: "swap", variable: "--rts-art-alfa" });
const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap", variable: "--rts-art-anton" });
const archivo = Archivo_Black({ subsets: ["latin"], weight: "400", display: "swap", variable: "--rts-art-archivo" });

/** Only the art sheet loads these, to compare against the game's own faces. */
export const ART_FONTS = [courier, cutive, xanh, alfa, anton, archivo].map((f) => f.variable).join(" ");

export interface FaceOption {
  name: string;
  family: string;
  note: string;
}

export const TYPEWRITERS: FaceOption[] = [
  { name: "Courier Prime", family: "var(--rts-art-courier), 'Courier New', monospace", note: "Clean and easy to read." },
  { name: "Special Elite", family: TYPE, note: "A worn ribbon and uneven ink: the most like a real typewriter. Picked, and now used across the game." },
  { name: "Cutive Mono", family: "var(--rts-art-cutive), 'Courier New', monospace", note: "Light and old-fashioned, like a carbon copy." },
  { name: "Xanh Mono", family: "var(--rts-art-xanh), 'Courier New', monospace", note: "Narrow with some character; fits more words on a phone." },
];

export const STAMP_FACES: FaceOption[] = [
  { name: "Oswald", family: DISPLAY, note: "Tall and condensed. The current face." },
  { name: "Alfa Slab One", family: "var(--rts-art-alfa), Georgia, serif", note: "Heavy slab serifs, like an old rubber stamp." },
  { name: "Anton", family: "var(--rts-art-anton), Impact, sans-serif", note: "Very tall and tight; loud even on a small stamp." },
  { name: "Archivo Black", family: "var(--rts-art-archivo), 'Arial Black', sans-serif", note: "Wide and heavy; stays readable when the ink is rough." },
];
