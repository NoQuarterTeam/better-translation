import { Composition } from "remotion"

import {
  BetterTranslationDemo,
  BetterTranslationTeaser,
  TEASER_DURATION,
  VIDEO_DURATION,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./video"

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="BetterTranslationDemo"
        component={BetterTranslationDemo}
        durationInFrames={VIDEO_DURATION}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="BetterTranslationTeaserLandscape"
        component={BetterTranslationTeaser}
        durationInFrames={TEASER_DURATION}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="BetterTranslationTeaserSquare"
        component={BetterTranslationTeaser}
        durationInFrames={TEASER_DURATION}
        fps={VIDEO_FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="BetterTranslationTeaserVertical"
        component={BetterTranslationTeaser}
        durationInFrames={TEASER_DURATION}
        fps={VIDEO_FPS}
        width={1080}
        height={1920}
      />
    </>
  )
}
