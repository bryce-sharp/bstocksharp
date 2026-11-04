import { Lora, Nunito } from "next/font/google";

export const lora = Lora({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], display: "swap", variable: "--rk-lora" });
export const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap", variable: "--rk-nunito" });
