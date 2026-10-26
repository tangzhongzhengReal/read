export const PDF_CSS_SCALE = 96 / 72;

export function pdfFitScale(
  pageWidth: number,
  containerWidth: number,
  maxScale = PDF_CSS_SCALE,
): number {
  if (!(pageWidth > 0) || !(containerWidth > 0)) return maxScale;
  const fitted = Math.max(0.1, (containerWidth - 1) / pageWidth);
  return Math.min(maxScale, fitted);
}
