const COMPACT = 80;
const OPEN_WIDTH = 448;
const OPEN_HEIGHT = 714;
const COLLAPSE_MS = 220;
const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), Math.max(min, max));

function placeExpanded(point, area) {
  const width = Math.min(OPEN_WIDTH, area.width);
  const height = Math.min(OPEN_HEIGHT, area.height);
  const side = point.x + COMPACT - width < area.x ? "left" : "right";
  const x = Math.round(
    clamp(
      side === "left" ? point.x : point.x + COMPACT - width,
      area.x,
      area.x + area.width - width,
    ),
  );
  const y = Math.round(clamp(point.y, area.y, area.y + area.height - height));
  return {
    bounds: { x, y, width, height },
    anchor: { x: side === "left" ? x : x + width - COMPACT, y },
    side,
  };
}
function bubbleAnchor(bounds, side) {
  return {
    x: bounds.x + (side === "left" ? 0 : bounds.width - COMPACT),
    y: bounds.y,
  };
}
module.exports = { COMPACT, COLLAPSE_MS, placeExpanded, bubbleAnchor };
