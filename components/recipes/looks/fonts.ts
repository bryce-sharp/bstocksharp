import { Baloo_2, Courier_Prime, Gaegu, Itim, Kalam, Mali, Patrick_Hand, Quicksand } from "next/font/google";
import { lora, nunito } from "@/components/recipes/fonts";

const kalam = Kalam({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--rk-kalam" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--rk-courier" });
const baloo = Baloo_2({ subsets: ["latin"], weight: ["500", "700", "800"], display: "swap", variable: "--rk-baloo" });
const patrick = Patrick_Hand({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--rk-patrick" });
const mali = Mali({ subsets: ["latin"], weight: ["500", "600"], display: "swap", variable: "--rk-mali" });
const gaegu = Gaegu({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--rk-gaegu" });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--rk-quicksand" });
const itim = Itim({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--rk-itim" });

/** Put on the lab's outermost element so every look's fonts are available inside it. */
export const LOOK_FONTS = [kalam, courier, baloo, nunito, patrick, lora, mali, gaegu, quicksand, itim].map((f) => f.variable).join(" ");
