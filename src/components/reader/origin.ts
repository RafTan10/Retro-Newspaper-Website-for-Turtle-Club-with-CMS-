/** Where a paper sits in the stack, in viewport pixels. The reader grows from here and returns to it. */
export type PaperOrigin = {
  cx: number;
  cy: number;
  width: number;
  rotate: number;
};

/** Papers are landscape, 6 wide by 5 tall, in the stack and in the reader */
export const PAPER_ASPECT = 6 / 5;
