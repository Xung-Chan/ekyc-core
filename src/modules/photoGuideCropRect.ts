export type Orientation =
  'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export type ManualPhotoCropPlan = {
  crop: Rect;
  cropCoordinateSpace: 'raw' | 'upright';
  bufferOrientation?: Orientation;
  sourcePhotoWidth: number;
  sourcePhotoHeight: number;
};

export type PhotoGuideCropInput = {
  previewSize: Size;
  guideFrame: Rect;
  photoWidth: number;
  photoHeight: number;
  photoOrientation: Orientation;
  guideRoiOutsetFraction?: number;
  previewContentMode?: 'cover' | 'fit';
  previewStreamSize?: Size;
  /** @deprecated Dùng `previewStreamSize`. */
  videoPixelSize?: Size;
  syncFrame?: { width: number; height: number; orientation: Orientation };
  debugLog?: boolean;
};

export const MANUAL_CARD_SCAN_GUIDE_OUTSET = {
  min: 0.1,
  max: 0.15,
  default: 0.125,
} as const;

const DEFAULT_GUIDE_WIDTH_FRACTION = 0.86;
const DEFAULT_GUIDE_ASPECT = 1.586;
const CARD_ASPECT_UPRIGHT_MANUAL_CROP = DEFAULT_GUIDE_ASPECT;
const ORIENTATION_PROBE_ORDER: Orientation[] = [
  'portrait',
  'landscape-right',
  'portrait-upside-down',
  'landscape-left',
];

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function getUprightSize(
  frameW: number,
  frameH: number,
  orientation: Orientation
): Size {
  return orientation === 'landscape-left' || orientation === 'landscape-right'
    ? { width: frameH, height: frameW }
    : { width: frameW, height: frameH };
}

export function mapGuideRectToUprightROI_Cover(
  preview: Size,
  upright: Size,
  guide: Rect
): Rect {
  const scale = Math.max(
    preview.width / upright.width,
    preview.height / upright.height
  );
  const drawnW = upright.width * scale;
  const drawnH = upright.height * scale;
  const offX = (preview.width - drawnW) / 2;
  const offY = (preview.height - drawnH) / 2;

  let x = (guide.x - offX) / scale;
  let y = (guide.y - offY) / scale;
  let w = guide.width / scale;
  let h = guide.height / scale;

  x = clamp(x, 0, upright.width - 1);
  y = clamp(y, 0, upright.height - 1);
  w = clamp(w, 1, upright.width - x);
  h = clamp(h, 1, upright.height - y);

  return { x, y, width: w, height: h };
}

export function mapGuideRectToUprightROI_FitCenter(
  preview: Size,
  upright: Size,
  guide: Rect
): Rect {
  const scale = Math.min(
    preview.width / upright.width,
    preview.height / upright.height
  );
  if (!Number.isFinite(scale) || scale <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const drawnW = upright.width * scale;
  const drawnH = upright.height * scale;
  const offX = (preview.width - drawnW) / 2;
  const offY = (preview.height - drawnH) / 2;

  let x = (guide.x - offX) / scale;
  let y = (guide.y - offY) / scale;
  let w = guide.width / scale;
  let h = guide.height / scale;

  x = clamp(x, 0, upright.width - 1);
  y = clamp(y, 0, upright.height - 1);
  w = clamp(w, 1, upright.width - x);
  h = clamp(h, 1, upright.height - y);

  return { x, y, width: w, height: h };
}

export function expandUprightRect(
  r: Rect,
  upright: Size,
  fractionEachSide: number
): Rect {
  if (fractionEachSide <= 0) {
    return r;
  }
  const wantDx = r.width * fractionEachSide;
  const wantDy = r.height * fractionEachSide;
  const maxDx = Math.min(r.x, upright.width - r.x - r.width);
  const maxDy = Math.min(r.y, upright.height - r.y - r.height);
  const dx = Math.min(wantDx, maxDx);
  const dy = Math.min(wantDy, maxDy);
  let x = r.x - dx;
  let y = r.y - dy;
  let w = r.width + 2 * dx;
  let h = r.height + 2 * dy;
  x = clamp(x, 0, upright.width - 1);
  y = clamp(y, 0, upright.height - 1);
  w = clamp(w, 1, upright.width - x);
  h = clamp(h, 1, upright.height - y);
  return { x, y, width: w, height: h };
}

export function clampManualCardScanGuideOutset(
  fromDetectionConfig?: number
): number {
  const v = fromDetectionConfig ?? MANUAL_CARD_SCAN_GUIDE_OUTSET.default;
  return Math.min(
    MANUAL_CARD_SCAN_GUIDE_OUTSET.max,
    Math.max(MANUAL_CARD_SCAN_GUIDE_OUTSET.min, v)
  );
}

export function computeCardScannerGuideRectInPreview(params: {
  previewWidth: number;
  previewHeight: number;
  widthFraction?: number;
  aspectRatio?: number;
}): Rect {
  const wFrac = params.widthFraction ?? DEFAULT_GUIDE_WIDTH_FRACTION;
  const aspect = params.aspectRatio ?? DEFAULT_GUIDE_ASPECT;
  const pw = params.previewWidth;
  const ph = params.previewHeight;
  if (pw < 2 || ph < 2) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const gw = pw * wFrac;
  const gh = gw / aspect;
  return {
    x: (pw - gw) / 2,
    y: (ph - gh) / 2,
    width: gw,
    height: gh,
  };
}

export const MANUAL_CROP_SOURCE_STILL_AR_REL_MAX = 0.05;

function uprightAspectRelDelta(a: Size, b: Size): number {
  const arA = a.width / a.height;
  const arB = b.width / b.height;
  return Math.abs(arA - arB) / Math.max(arA, arB, 1e-9);
}

function rotateOrientationClockwise(o: Orientation): Orientation {
  switch (o) {
    case 'portrait':
      return 'landscape-right';
    case 'landscape-right':
      return 'portrait-upside-down';
    case 'portrait-upside-down':
      return 'landscape-left';
    case 'landscape-left':
      return 'portrait';
  }
}

export function alignPhotoOrientationForManualCrop(
  raw: Size,
  reported: Orientation,
  preview: Size
): Orientation {
  if (
    preview.width < 2 ||
    preview.height < 2 ||
    raw.width < 2 ||
    raw.height < 2
  ) {
    return reported;
  }
  const previewWide = preview.width > preview.height;
  let o: Orientation = reported;
  for (let i = 0; i < 4; i++) {
    const upright = getUprightSize(raw.width, raw.height, o);
    const uprightWide = upright.width > upright.height;
    if (previewWide === uprightWide) {
      return o;
    }
    o = rotateOrientationClockwise(o);
  }
  return reported;
}

function resolvePhotoOrientationForManualCrop(
  rawPhoto: Size,
  reported: Orientation,
  uprightFrameOrNull: Size | null,
  previewSize: Size,
  frameOrientationHint: Orientation | null
): Orientation {
  const refTall =
    uprightFrameOrNull != null &&
    uprightFrameOrNull.width >= 2 &&
    uprightFrameOrNull.height >= 2
      ? uprightFrameOrNull.height > uprightFrameOrNull.width
      : previewSize.height > previewSize.width;

  const candidates: Orientation[] = [];
  for (const o of ORIENTATION_PROBE_ORDER) {
    const u = getUprightSize(rawPhoto.width, rawPhoto.height, o);
    if (u.height > u.width === refTall) {
      candidates.push(o);
    }
  }
  if (candidates.length === 0) {
    return reported;
  }
  if (candidates.includes(reported)) {
    return reported;
  }
  if (
    frameOrientationHint != null &&
    candidates.includes(frameOrientationHint)
  ) {
    return frameOrientationHint;
  }
  return candidates[0]!;
}

function resolveVideoOrientationMatchPreview(
  streamRaw: Size,
  previewSize: Size
): Orientation {
  const refTall = previewSize.height > previewSize.width;
  for (const o of ORIENTATION_PROBE_ORDER) {
    const u = getUprightSize(streamRaw.width, streamRaw.height, o);
    if (u.height > u.width === refTall) {
      return o;
    }
  }
  return 'landscape-right';
}

function mapUprightRoiUniformScaleCentered(
  r: Rect,
  uprightFrom: Size,
  uprightTo: Size
): Rect {
  if (
    uprightFrom.width < 2 ||
    uprightFrom.height < 2 ||
    uprightTo.width < 2 ||
    uprightTo.height < 2
  ) {
    return r;
  }
  const sW = uprightTo.width / uprightFrom.width;
  const sH = uprightTo.height / uprightFrom.height;
  const rel = Math.abs(sW - sH) / Math.max(sW, sH, Number.EPSILON);
  let s: number;
  let offX = 0;
  let offY = 0;
  if (rel < 1e-4) {
    s = sW;
  } else {
    s = Math.min(sW, sH);
    offX = (uprightTo.width - uprightFrom.width * s) / 2;
    offY = (uprightTo.height - uprightFrom.height * s) / 2;
  }
  let x = r.x * s + offX;
  let y = r.y * s + offY;
  let w = r.width * s;
  let h = r.height * s;
  x = Math.max(0, Math.min(x, uprightTo.width - 1));
  y = Math.max(0, Math.min(y, uprightTo.height - 1));
  w = Math.max(1, Math.min(w, uprightTo.width - x));
  h = Math.max(1, Math.min(h, uprightTo.height - y));
  return { x, y, width: w, height: h };
}

function roundClampUprightRoi(r: Rect, upright: Size): Rect {
  let ux = Math.round(r.x);
  let uy = Math.round(r.y);
  let uw = Math.max(1, Math.round(r.width));
  let uh = Math.max(1, Math.round(r.height));
  ux = Math.max(0, Math.min(ux, upright.width - 1));
  uy = Math.max(0, Math.min(uy, upright.height - 1));
  uw = Math.min(uw, upright.width - ux);
  uh = Math.min(uh, upright.height - uy);
  return { x: ux, y: uy, width: Math.max(1, uw), height: Math.max(1, uh) };
}

export function computePhotoRawCropRectForCardScan(
  input: PhotoGuideCropInput
): ManualPhotoCropPlan {
  const outset =
    input.guideRoiOutsetFraction ?? MANUAL_CARD_SCAN_GUIDE_OUTSET.default;

  const W = input.photoWidth;
  const H = input.photoHeight;

  if (
    input.previewSize.width < 2 ||
    input.previewSize.height < 2 ||
    W < 2 ||
    H < 2
  ) {
    return {
      crop: { x: 0, y: 0, width: Math.max(1, W), height: Math.max(1, H) },
      cropCoordinateSpace: 'raw',
      sourcePhotoWidth: W,
      sourcePhotoHeight: H,
    };
  }

  const rawPhoto: Size = { width: W, height: H };
  const photoOrientation = input.photoOrientation;
  const mode = input.previewContentMode ?? 'cover';

  const mapViaSourceUprightThenPhotoUpright = (
    sourceRaw: Size,
    sourceOrientation: Orientation,
    frameOrientationHint: Orientation | null
  ): ManualPhotoCropPlan => {
    const fW = sourceRaw.width;
    const fH = sourceRaw.height;
    const uprightSource = getUprightSize(fW, fH, sourceOrientation);
    const photoOrientResolved = resolvePhotoOrientationForManualCrop(
      rawPhoto,
      photoOrientation,
      uprightSource,
      input.previewSize,
      frameOrientationHint
    );
    const uprightPhoto = getUprightSize(W, H, photoOrientResolved);
    let roiFromGuide =
      mode === 'fit'
        ? mapGuideRectToUprightROI_FitCenter(
            input.previewSize,
            uprightSource,
            input.guideFrame
          )
        : mapGuideRectToUprightROI_Cover(
            input.previewSize,
            uprightSource,
            input.guideFrame
          );
    let roiU = expandUprightRect(roiFromGuide, uprightSource, outset);
    roiU = roundClampUprightRoi(roiU, uprightSource);
    const roiOnPhotoUpright = mapUprightRoiUniformScaleCentered(
      roiU,
      uprightSource,
      uprightPhoto
    );
    const roiFinalU = roundClampUprightRoi(roiOnPhotoUpright, uprightPhoto);
    let ux = Math.round(roiFinalU.x);
    let uy = Math.round(roiFinalU.y);
    let uw = Math.max(1, Math.round(roiFinalU.width));
    let uh = Math.max(1, Math.round(roiFinalU.height));
    const upW = uprightPhoto.width;
    const upH = uprightPhoto.height;
    ux = Math.max(0, Math.min(ux, upW - 1));
    uy = Math.max(0, Math.min(uy, upH - 1));
    uw = Math.min(uw, upW - ux);
    uh = Math.min(uh, upH - uy);
    const outUpright = {
      x: ux,
      y: uy,
      width: Math.max(1, uw),
      height: Math.max(1, uh),
    };
    return {
      crop: outUpright,
      cropCoordinateSpace: 'upright',
      bufferOrientation: photoOrientResolved,
      sourcePhotoWidth: W,
      sourcePhotoHeight: H,
    };
  };

  const arTol = MANUAL_CROP_SOURCE_STILL_AR_REL_MAX;

  const sync = input.syncFrame;
  if (sync && sync.width >= 2 && sync.height >= 2) {
    const uprightSync = getUprightSize(
      sync.width,
      sync.height,
      sync.orientation
    );
    const photoOforSync = resolvePhotoOrientationForManualCrop(
      rawPhoto,
      photoOrientation,
      uprightSync,
      input.previewSize,
      sync.orientation
    );
    const uprightPhotoForSync = getUprightSize(W, H, photoOforSync);
    const arDeltaSync = uprightAspectRelDelta(uprightSync, uprightPhotoForSync);
    if (arDeltaSync <= arTol) {
      return mapViaSourceUprightThenPhotoUpright(
        { width: sync.width, height: sync.height },
        sync.orientation,
        sync.orientation
      );
    }
  }

  const explicitStream = input.previewStreamSize ?? input.videoPixelSize;
  if (
    explicitStream &&
    explicitStream.width >= 2 &&
    explicitStream.height >= 2
  ) {
    const streamO = resolveVideoOrientationMatchPreview(
      {
        width: explicitStream.width,
        height: explicitStream.height,
      },
      input.previewSize
    );
    const uprightStream = getUprightSize(
      explicitStream.width,
      explicitStream.height,
      streamO
    );
    const photoOforStream = resolvePhotoOrientationForManualCrop(
      rawPhoto,
      photoOrientation,
      uprightStream,
      input.previewSize,
      streamO
    );
    const uprightPhotoForStream = getUprightSize(W, H, photoOforStream);
    const arDeltaStream = uprightAspectRelDelta(
      uprightStream,
      uprightPhotoForStream
    );
    if (arDeltaStream <= arTol) {
      return mapViaSourceUprightThenPhotoUpright(
        { width: explicitStream.width, height: explicitStream.height },
        streamO,
        streamO
      );
    }
  }

  const frameOrientationHintDirect =
    sync && sync.width >= 2 && sync.height >= 2
      ? sync.orientation
      : explicitStream &&
          explicitStream.width >= 2 &&
          explicitStream.height >= 2
        ? resolveVideoOrientationMatchPreview(
            {
              width: explicitStream.width,
              height: explicitStream.height,
            },
            input.previewSize
          )
        : null;

  const photoOrientDirect = resolvePhotoOrientationForManualCrop(
    rawPhoto,
    photoOrientation,
    null,
    input.previewSize,
    frameOrientationHintDirect
  );
  const uprightPhotoDirect = getUprightSize(W, H, photoOrientDirect);

  let roiFromGuide =
    mode === 'fit'
      ? mapGuideRectToUprightROI_FitCenter(
          input.previewSize,
          uprightPhotoDirect,
          input.guideFrame
        )
      : mapGuideRectToUprightROI_Cover(
          input.previewSize,
          uprightPhotoDirect,
          input.guideFrame
        );

  let roiUpright = expandUprightRect(roiFromGuide, uprightPhotoDirect, outset);
  roiUpright = roundClampUprightRoi(roiUpright, uprightPhotoDirect);

  const cropX = roiUpright.x;
  const cropW = roiUpright.width;
  const cropHFromAspect = Math.max(
    1,
    Math.round(cropW / CARD_ASPECT_UPRIGHT_MANUAL_CROP)
  );
  const centerY = roiUpright.y + roiUpright.height / 2;
  let cropY = Math.round(centerY - cropHFromAspect / 2);
  const uh = uprightPhotoDirect.height;
  let cropH = Math.min(cropHFromAspect, uh - Math.max(0, cropY));
  cropY = Math.max(0, Math.min(cropY, uh - cropH));
  cropH = Math.max(1, Math.min(cropH, uh - cropY));

  const cropUpright = {
    x: cropX,
    y: cropY,
    width: cropW,
    height: cropH,
  };

  return {
    crop: cropUpright,
    cropCoordinateSpace: 'upright',
    bufferOrientation: photoOrientDirect,
    sourcePhotoWidth: W,
    sourcePhotoHeight: H,
  };
}
