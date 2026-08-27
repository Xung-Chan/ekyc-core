import { useState, useMemo, useCallback } from 'react';
import { Dimensions, type LayoutChangeEvent } from 'react-native';
import {
  computeCardScannerGuideRectInPreview,
  type Rect,
} from '../modules/photoGuideCropRect';
import {
  lBracketPathRoundBottomLeft,
  lBracketPathRoundBottomRight,
  lBracketPathRoundTopLeft,
  lBracketPathRoundTopRight,
} from '../utils/cardScannerHelpers';
import type { CardScannerCameraViewGuideConfig } from '../components/CardScannerCameraView';

const SCREEN = Dimensions.get('window');

const DEFAULT_GUIDE = {
  widthFraction: 0.86,
  aspectRatio: 1.586,
};

const FIGMA_GUIDE_W = 375;
const FIGMA_HOLE_RX = 10;
const BRACKET_L_CORNER_RADIUS_PX = 10;

export function useCardScannerGuideLayout(
  guideCfg: CardScannerCameraViewGuideConfig
) {
  const [previewSize, setPreviewSize] = useState({
    width: SCREEN.width,
    height: SCREEN.height,
  });

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const overlayGuide: Rect = useMemo(
    () =>
      computeCardScannerGuideRectInPreview({
        previewWidth: previewSize.width,
        previewHeight: previewSize.height,
        widthFraction: guideCfg.widthFraction ?? DEFAULT_GUIDE.widthFraction,
        aspectRatio: guideCfg.aspectRatio ?? DEFAULT_GUIDE.aspectRatio,
      }),
    [
      previewSize.width,
      previewSize.height,
      guideCfg.widthFraction,
      guideCfg.aspectRatio,
    ]
  );

  const guideFrameStyle = useMemo(() => {
    if (overlayGuide.width > 0.5 && overlayGuide.height > 0.5) {
      return { width: overlayGuide.width, height: overlayGuide.height };
    }
    const wFrac = guideCfg.widthFraction ?? DEFAULT_GUIDE.widthFraction;
    const aspect = guideCfg.aspectRatio ?? DEFAULT_GUIDE.aspectRatio;
    const w = SCREEN.width * wFrac;
    return { width: w, height: w / aspect };
  }, [
    overlayGuide.height,
    overlayGuide.width,
    guideCfg.aspectRatio,
    guideCfg.widthFraction,
  ]);

  const figmaGuideOverlayGeom = useMemo(() => {
    const pw = previewSize.width;
    const ph = previewSize.height;
    const gw = guideFrameStyle.width;
    const gh = guideFrameStyle.height;
    if (pw < 2 || ph < 2 || gw < 2 || gh < 2) {
      return null;
    }
    const hx = (pw - gw) / 2;
    const hy = (ph - gh) / 2;
    const rx = Math.min(
      (FIGMA_HOLE_RX / FIGMA_GUIDE_W) * pw,
      gw * 0.5 - 0.5,
      gh * 0.5 - 0.5
    );
    const brLen = Math.min(28, Math.min(gw, gh) * 0.09);
    return { pw, ph, hx, hy, gw, gh, rx, brLen };
  }, [
    previewSize.height,
    previewSize.width,
    guideFrameStyle.height,
    guideFrameStyle.width,
  ]);

  const figmaBracketPaths = useMemo(() => {
    if (figmaGuideOverlayGeom == null) {
      return null;
    }
    const g = figmaGuideOverlayGeom;
    const { hx, hy, gw, gh, brLen } = g;
    const x1 = hx + gw;
    const y1 = hy + gh;
    const r = BRACKET_L_CORNER_RADIUS_PX;
    return {
      tl: lBracketPathRoundTopLeft(hx, hy, brLen, r),
      tr: lBracketPathRoundTopRight(x1, hy, brLen, r),
      bl: lBracketPathRoundBottomLeft(hx, y1, brLen, r),
      br: lBracketPathRoundBottomRight(x1, y1, brLen, r),
    };
  }, [figmaGuideOverlayGeom]);

  return {
    previewSize,
    onPreviewLayout,
    overlayGuide,
    guideFrameStyle,
    figmaGuideOverlayGeom,
    figmaBracketPaths,
  };
}
