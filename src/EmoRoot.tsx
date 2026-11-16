import React from "react";
import { Composition } from "remotion";
import { EmuShort, EMU_FRAMES } from "./videos/emo/Emo";

export const EmoRoot: React.FC = () => (
  <Composition
    id="EmuShort"
    component={EmuShort}
    durationInFrames={EMU_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
