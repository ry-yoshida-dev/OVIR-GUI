interface CropMarginFigureProps {
  marginPercent: number;
}

const BOX_WIDTH = 60;
const BOX_HEIGHT = 40;
const MAXIMUM_CROP_WIDTH = 96;

/**
 * Sketch of a detected box inside the crop its margin widens it to.
 */
export function CropMarginFigure({ marginPercent }: CropMarginFigureProps) {
  const growth = 1 + (2 * marginPercent) / 100;
  const scale = Math.min(1, MAXIMUM_CROP_WIDTH / (BOX_WIDTH * growth));
  const boxWidth = BOX_WIDTH * scale;
  const boxHeight = BOX_HEIGHT * scale;
  return (
    <div className="crop-figure" role="img" aria-label={`Crop with a ${marginPercent}% margin around the box`}>
      <div className="crop-figure-crop" style={{ width: boxWidth * growth, height: boxHeight * growth }}>
        <div className="crop-figure-box" style={{ width: boxWidth, height: boxHeight }} />
      </div>
    </div>
  );
}
