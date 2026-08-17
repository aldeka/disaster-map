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

export function createStripeTile(
  color,
  widthPx,
  angleDeg,
  gapPx,
  bgOpacity = 0.5,
) {
  const { canvas, ctx } = makeTileCanvas();
  ctx.save();
  ctx.globalAlpha = bgOpacity;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.restore();

  const period = widthPx + gapPx;
  const angleRad = (angleDeg * Math.PI) / 180;

  // A plain ctx.rotate() draws smooth, correctly-angled stripes, but the
  // result only repeats seamlessly across tile edges by coincidence --
  // MapLibre (and the toggle backgrounds) tile this square edge-to-edge
  // with no blending, so any mismatch shows up as a visible seam.
  //
  // Fixed by snapping the angle to atan2(b, a) for small integers
  // a, b: such an angle has cos/sin that are *exact* rational multiples of
  // 1/hypot(a,b), so a stripe spacing of TILE_SIZE/hypot(a,b) divides the
  // tile evenly in both x and y -- while still being a real rotation, so
  // the stripes stay perfectly straight. a is chosen so that spacing comes
  // out close to the requested period; b then comes from the requested
  // angle's tangent, snapped to match.
  const cosA = Math.cos(angleRad);
  let a, b;
  if (Math.abs(cosA) < 1e-9) {
    a = 0;
    b = Math.max(1, Math.round(TILE_SIZE / period));
  } else {
    a = Math.max(1, Math.round((TILE_SIZE * Math.abs(cosA)) / period));
    b = Math.round(a * Math.tan(angleRad));
  }
  const mag = Math.hypot(a, b);
  const snappedAngleRad = Math.atan2(b, a);
  const perpPeriod = TILE_SIZE / mag;
  const perpWidth = widthPx * (perpPeriod / period);

  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(TILE_SIZE / 2, TILE_SIZE / 2);
  ctx.rotate(snappedAngleRad);
  const span = TILE_SIZE * 2;
  for (let y = -span; y <= span; y += perpPeriod) {
    ctx.fillRect(-span, y, span * 2, perpWidth);
  }
  ctx.restore();

  return canvas;
}

export function createDotTile(
  color,
  dotRadiusPx = 1,
  spacingPx = 4,
  bgOpacity = 0.6,
) {
  const { canvas, ctx } = makeTileCanvas();
  ctx.save();
  ctx.globalAlpha = bgOpacity;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.restore();
  ctx.fillStyle = color;
  let row = 0;
  for (let y = spacingPx / 2; y < TILE_SIZE; y += spacingPx) {
    row += 1;
    for (let x = spacingPx / 2; x < TILE_SIZE; x += spacingPx) {
      ctx.beginPath();
      ctx.arc(
        !!(row % 2) ? x : x + spacingPx / 2,
        y,
        dotRadiusPx,
        0,
        Math.PI * 2,
      );
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

function createTileCanvas(spec, color) {
  if (spec.type === "stripes") {
    return createStripeTile(color, spec.width, spec.angle, spec.gap ?? 1);
  }
  if (spec.type === "dots") {
    return createDotTile(color);
  }
  throw new Error(`Unknown pattern type: ${spec.type}`);
}

export function createPatternTile(spec, color) {
  return toImageData(createTileCanvas(spec, color));
}

// Same tile the map's fill-pattern uses, as a CSS-usable data URL -- lets
// the legend toggles show the real pattern instead of a flat color swatch,
// without re-implementing stripes/dots a second time in CSS.
export function createPatternTileDataUrl(spec, color) {
  return createTileCanvas(spec, color).toDataURL();
}
