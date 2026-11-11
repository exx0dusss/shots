/**
 * Where the frames sit on the canvas. Pure geometry in CSS px, no browser:
 * every frame gets a centre, a scale and a rotation, and the canvas is sized
 * from the bounding box of the result.
 */

/** Bounding box of a w×h rectangle rotated by `deg` about its centre. */
export function rotatedSize(width, height, deg) {
  const r = (Math.abs(deg) * Math.PI) / 180;
  return {
    width: width * Math.cos(r) + height * Math.sin(r),
    height: width * Math.sin(r) + height * Math.cos(r),
  };
}

// A phone, or a window as narrow as one (a desktop Mini App): two of them sit
// side by side, one of them goes in front of a full-size window.
const isSmall = (frame) => frame.small ?? frame.device === "phone";

const PAIR_GAP = 0.14; // gap between two phones, as a share of a phone's width
const PAIR_DROP = 28; // the second of a pair sits a little lower
const PHONE_SCALE = 0.78; // the phone in front of a desktop window
const PHONE_OVERHANG = { x: 70, y: 50 }; // how far it sticks out of the window

/**
 * @param {{device:string,width:number,height:number}[]} frames  one or two
 * @param {number} tilt  degrees. One frame, or desktop with phone: the whole
 *   group turns. Two of the same device: they fan apart, -tilt and +tilt.
 * @returns {{ items: {cx:number,cy:number,scale:number,rotate:number,z:number}[],
 *   width:number, height:number, rotate:number, box:{width:number,height:number} }}
 *   `width`/`height` is the stage before its own rotation, `box` after it.
 */
export function arrange(frames, tilt = 0) {
  let items;
  let rotate = tilt;
  if (frames.length === 1) {
    items = [{ cx: 0, cy: 0, scale: 1, rotate: 0, z: 1 }];
  } else if (frames.length === 2 && isSmall(frames[0]) === isSmall(frames[1])) {
    if (!isSmall(frames[0])) {
      throw new Error("Two desktops do not fit one canvas; use two phones, or desktop with phone");
    }
    const [a, b] = frames;
    const gap = Math.round(a.width * PAIR_GAP);
    items = [
      { cx: -(gap + a.width) / 2, cy: 0, scale: 1, rotate: -tilt, z: 1 },
      { cx: (gap + b.width) / 2, cy: PAIR_DROP, scale: 1, rotate: tilt, z: 2 },
    ];
    rotate = 0;
  } else if (frames.length === 2) {
    const d = frames.findIndex((f) => !isSmall(f));
    const desk = frames[d];
    const phone = frames[1 - d];
    items = [];
    items[d] = { cx: 0, cy: 0, scale: 1, rotate: 0, z: 1 };
    items[1 - d] = {
      cx: desk.width / 2 + PHONE_OVERHANG.x - (phone.width * PHONE_SCALE) / 2,
      cy: desk.height / 2 + PHONE_OVERHANG.y - (phone.height * PHONE_SCALE) / 2,
      scale: PHONE_SCALE,
      rotate: 0,
      z: 2,
    };
  } else {
    throw new Error("Give one or two sources");
  }

  // bounding box of all frames, then move the origin to its top-left corner
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  items.forEach((item, i) => {
    const size = rotatedSize(
      frames[i].width * item.scale,
      frames[i].height * item.scale,
      item.rotate,
    );
    minX = Math.min(minX, item.cx - size.width / 2);
    maxX = Math.max(maxX, item.cx + size.width / 2);
    minY = Math.min(minY, item.cy - size.height / 2);
    maxY = Math.max(maxY, item.cy + size.height / 2);
  });
  for (const item of items) {
    item.cx -= minX;
    item.cy -= minY;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  return { items, width, height, rotate, box: rotatedSize(width, height, rotate) };
}

/**
 * The canvas: the stage plus padding, grown (never shrunk) to `aspect`.
 * @param {{width:number,height:number}} box
 * @param {number} pad
 * @param {[number,number]|null} aspect
 */
export function canvasSize(box, pad, aspect) {
  let width = Math.ceil(box.width + pad * 2);
  let height = Math.ceil(box.height + pad * 2);
  if (aspect) {
    const [w, h] = aspect;
    if (width / height < w / h) width = Math.round((height * w) / h);
    else height = Math.round((width * h) / w);
  }
  return { width, height };
}
