// The shared result: a silhouette of the quilt (orange) with holes (brown), never which patch went where.

import { cellKey, outlineLoops, type Cell } from "./pieces";
import { BINDING, LINEN, YARNS } from "./quilt";
import { RED_THREAD, type PieceState } from "./parts";

const FILLED = "\u{1F7E7}";
const HOLE = "\u{1F7EB}";
const OUTSIDE = "⬜";

function filledCells(pieces: readonly PieceState[]): Set<string> {
  const filled = new Set<string>();
  for (const p of pieces) {
    if (!p.at || p.loose) continue;
    for (const [x, y] of p.cells) filled.add(cellKey(x + p.at.x, y + p.at.y));
  }
  return filled;
}

/** One line per board row; squares outside the quilt are white, so every square is the same width and the shape lines up. */
export function quiltGrid(board: readonly Cell[], cols: number, rows: number, pieces: readonly PieceState[]): string {
  const inBoard = new Set(board.map(([x, y]) => cellKey(x, y)));
  const filled = filledCells(pieces);
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const k = cellKey(x, y);
      line += !inBoard.has(k) ? OUTSIDE : filled.has(k) ? FILLED : HOLE;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/** The page's resolved Snug fonts, which a canvas cannot take as CSS variables, once they have loaded. */
export async function canvasFonts(el: HTMLElement): Promise<{ script: string; body: string }> {
  const style = getComputedStyle(el);
  const script = style.getPropertyValue("--snug-font-script").trim() || "cursive";
  const body = style.getPropertyValue("--snug-font-body").trim() || "system-ui, sans-serif";
  await Promise.all([document.fonts.load(`700 96px ${script}`), document.fonts.load(`600 44px ${body}`), document.fonts.load(`400 30px ${body}`)]).catch(() => {});
  return { script, body };
}

export function canvasFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(new File([b], name, { type: "image/png" })) : reject(new Error("no picture"))), "image/png"),
  );
}

/** The day's shared picture, 1080 square: the same silhouette as the text grid, sewn like the quilt, with the result. */
export function drawResultPicture(
  puzzle: { board: readonly Cell[]; cols: number; rows: number },
  pieces: readonly PieceState[],
  text: { title: string; result: string; link: string },
  fonts: { script: string; body: string },
): HTMLCanvasElement {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = LINEN;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#a35a42";
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 14]);
  ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.setLineDash([]);

  ctx.fillStyle = BINDING;
  ctx.textAlign = "center";
  ctx.font = `700 110px ${fonts.script}`;
  ctx.fillText("Snug", W / 2, 165);
  ctx.font = `500 38px ${fonts.body}`;
  ctx.fillText(text.title, W / 2, 228);

  const area = { x: 130, y: 280, w: W - 260, h: 560 };
  const cell = Math.floor(Math.min(area.w / puzzle.cols, area.h / puzzle.rows));
  const ox = area.x + (area.w - puzzle.cols * cell) / 2;
  const oy = area.y + (area.h - puzzle.rows * cell) / 2;
  const traceBoard = () => {
    ctx.beginPath();
    for (const loop of outlineLoops(puzzle.board)) {
      loop.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * cell, oy + y * cell) : ctx.moveTo(ox + x * cell, oy + y * cell)));
      ctx.closePath();
    }
  };

  const filled = filledCells(pieces);
  // Tangerine, like the orange squares in the text.
  const yarn = YARNS.find((y) => y.name === "tangerine")!;
  traceBoard();
  ctx.fillStyle = "#efe3cb";
  ctx.fill();
  for (const [x, y] of puzzle.board) {
    const [px, py] = [ox + x * cell, oy + y * cell];
    if (filled.has(cellKey(x, y))) {
      ctx.fillStyle = yarn.base;
      ctx.fillRect(px, py, cell, cell);
      ctx.strokeStyle = yarn.dark;
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.strokeRect(px, py, cell, cell);
    } else {
      ctx.strokeStyle = RED_THREAD;
      ctx.lineWidth = Math.max(1, cell * 0.09);
      ctx.beginPath();
      ctx.moveTo(px + cell * 0.3, py + cell * 0.3);
      ctx.lineTo(px + cell * 0.7, py + cell * 0.7);
      ctx.moveTo(px + cell * 0.7, py + cell * 0.3);
      ctx.lineTo(px + cell * 0.3, py + cell * 0.7);
      ctx.stroke();
    }
  }
  traceBoard();
  ctx.strokeStyle = BINDING;
  ctx.lineWidth = Math.max(2, cell * 0.16);
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.fillStyle = BINDING;
  ctx.font = `600 46px ${fonts.body}`;
  ctx.fillText(text.result, W / 2, 935);
  ctx.globalAlpha = 0.7;
  ctx.font = `400 28px ${fonts.body}`;
  ctx.fillText(text.link.replace(/^https?:\/\//, ""), W / 2, 995);
  ctx.globalAlpha = 1;
  return canvas;
}
