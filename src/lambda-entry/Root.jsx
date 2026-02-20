import { Composition } from 'remotion';
import { MainComposition } from './MainComposition';

export const Root = () => (
  <Composition
    id="MainVideo"
    component={MainComposition}
    durationInFrames={150}
    fps={30}
    width={1280}
    height={720}
  />
);
