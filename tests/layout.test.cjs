const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  placeExpanded,
  COMPACT,
  bubbleAnchor,
} = require("../electron/layout.cjs");

test("panel opens below the orb while its screen position is preserved", () => {
  const area = { x: 0, y: 0, width: 1440, height: 1000 };
  const point = { x: 1320, y: 40 };
  const result = placeExpanded(point, area);
  assert.equal(result.side, "right");
  assert.deepEqual(result.anchor, point);
  assert.equal(result.bounds.y, point.y);
  assert.equal(result.bounds.x + result.bounds.width - COMPACT, point.x);
});
test("left-edge orb expands towards the right without horizontal jumping", () => {
  const point = { x: 10, y: 40 };
  const result = placeExpanded(point, {
    x: 0,
    y: 0,
    width: 1440,
    height: 1000,
  });
  assert.equal(result.side, "left");
  assert.deepEqual(result.anchor, point);
  assert.equal(result.bounds.x, point.x);
  assert.deepEqual(bubbleAnchor(result.bounds, result.side), point);
});
test("bottom-edge, short-screen and negative-coordinate displays remain inside the work area", () => {
  for (const area of [
    { x: 0, y: 0, width: 1440, height: 900 },
    { x: -1280, y: -120, width: 1280, height: 600 },
    { x: 0, y: 0, width: 360, height: 640 },
  ]) {
    const result = placeExpanded(
      { x: area.x + area.width - 80, y: area.y + area.height - 80 },
      area,
    );
    assert.ok(result.bounds.x >= area.x);
    assert.ok(result.bounds.y >= area.y);
    assert.ok(result.bounds.x + result.bounds.width <= area.x + area.width);
    assert.ok(result.bounds.y + result.bounds.height <= area.y + area.height);
    assert.equal(result.anchor.y, result.bounds.y);
    assert.ok(result.bounds.height > COMPACT);
  }
});
