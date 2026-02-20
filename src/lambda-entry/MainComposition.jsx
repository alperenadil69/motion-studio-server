import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const MainComposition = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#08080f', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: '#c9a96e', fontSize: 64, fontFamily: 'sans-serif', opacity }}>
        Motion Studio
      </div>
    </AbsoluteFill>
  );
};
