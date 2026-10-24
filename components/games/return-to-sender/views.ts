import type * as React from "react";
import { SHEET_VIEW } from "./boards/SheetView";
import type { BoardId, Cells } from "./engine";

export interface EditorProps {
  cells: Cells;
  /** Gets an update from the latest cells, so several changes in one drag all land. */
  onChange: (update: (prev: Cells) => Cells) => void;
  disabled?: boolean;
}

/** How a board looks and is built on the page. */
export interface BoardView {
  empty: () => Cells;
  Editor: React.ComponentType<EditorProps>;
  Thumb: React.ComponentType<{ cells: Cells }>;
  /** A short description for screen readers. */
  describe: (cells: Cells) => string;
  howTo: string;
  submitLabel: string;
}

export const VIEWS: Record<BoardId, BoardView> = { sheet: SHEET_VIEW };
