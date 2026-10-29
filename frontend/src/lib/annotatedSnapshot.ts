const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * Picture shown in the viewer with the overlay drawn on it at the current zoom.
 */
export interface ShownPicture {
  src: string;
  overlay: SVGGElement;
  width: number;
  height: number;
  scale: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Cannot load ${src}`));
    image.src = src;
  });
}

function scaledLengths(value: string, factor: number): string {
  return value
    .split(/[\s,]+/)
    .filter((part) => part !== "")
    .map((part) => String(Number(part) * factor))
    .join(" ");
}

function overlayMarkup(overlay: SVGGElement, width: number, height: number, scale: number): string {
  const copy = overlay.cloneNode(true) as SVGGElement;
  const factor = 1 / scale;
  for (const element of copy.querySelectorAll('[vector-effect="non-scaling-stroke"]')) {
    element.removeAttribute("vector-effect");
    const strokeWidth = element.getAttribute("stroke-width");
    if (strokeWidth !== null) element.setAttribute("stroke-width", String(Number(strokeWidth) * factor));
    const dash = element.getAttribute("stroke-dasharray");
    if (dash !== null) element.setAttribute("stroke-dasharray", scaledLengths(dash, factor));
  }
  const root = document.createElementNS(SVG_NAMESPACE, "svg");
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.appendChild(copy);
  return new XMLSerializer().serializeToString(root);
}

/**
 * Draws a picture at its full size with the overlay shown on it, keeping labels and lines
 * in the proportion they have on screen at the given zoom.
 */
export async function annotatedSnapshot({ src, overlay, width, height, scale }: ShownPicture): Promise<Blob> {
  const markup = overlayMarkup(overlay, width, height, scale);
  const overlayUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const [picture, drawn] = await Promise.all([loadImage(src), loadImage(overlayUrl)]);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas is not available");
    context.drawImage(picture, 0, 0, width, height);
    context.drawImage(drawn, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob === null ? reject(new Error("Cannot encode the picture")) : resolve(blob)), "image/png");
    });
  } finally {
    URL.revokeObjectURL(overlayUrl);
  }
}

/**
 * Puts the annotated picture on the clipboard as PNG.
 */
export async function copyAnnotatedSnapshot(picture: ShownPicture): Promise<void> {
  if (typeof ClipboardItem === "undefined" || navigator.clipboard === undefined) {
    throw new Error("Copying pictures needs the page opened over https or localhost");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": annotatedSnapshot(picture) }),
  ]);
}
