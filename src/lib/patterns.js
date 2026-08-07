// MapLibre's fill-pattern paint property needs a raster tile, not CSS -
// generate stripe/dot pattern tiles on canvas, reading the fill color from
// the corresponding CSS custom property so patterns stay in sync with
// style.css. fill-opacity is applied separately by the caller, so these
// are drawn at full alpha.
const TILE_SIZE = 64;
const PIXEL_RATIO = 2;

export function resolveColor(cssVar) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
}

function makeTileCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * PIXEL_RATIO;
  canvas.height = TILE_SIZE * PIXEL_RATIO;
  const ctx = canvas.getContext("2d");
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  return { canvas, ctx };
}

export function createStripeTile(color, widthPx, angleDeg, gapPx) {
  const { canvas, ctx } = makeTileCanvas();
  const period = widthPx + gapPx;
  ctx.save();
  ctx.translate(TILE_SIZE / 2, TILE_SIZE / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  const span = TILE_SIZE * 2;
  for (let y = -span; y <= span; y += period) {
    ctx.fillRect(-span, y, span * 2, widthPx);
  }
  ctx.restore();
  return canvas;
}

export function createDotTile(color, dotRadiusPx = 2, spacingPx = 8) {
  const { canvas, ctx } = makeTileCanvas();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "black";
  for (let y = spacingPx / 2; y < TILE_SIZE; y += spacingPx) {
    for (let x = spacingPx / 2; x < TILE_SIZE; x += spacingPx) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

// MapLibre's addImage() only accepts HTMLImageElement | ImageBitmap | ImageData |
// {width,height,data} -- a raw <canvas> silently fails to register, so convert.
function toImageData(canvas) {
  const ctx = canvas.getContext("2d");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function createPatternTile(spec, color) {
  if (spec.type === "stripes") {
    return toImageData(
      createStripeTile(color, spec.width, spec.angle, spec.gap ?? 1),
    );
  }
  if (spec.type === "dots") {
    return toImageData(createDotTile(color));
  }
  throw new Error(`Unknown pattern type: ${spec.type}`);
}
