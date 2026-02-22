import React from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFrame(seconds, fps) {
  return Math.round(seconds * fps);
}

function groupWords(words, size) {
  const groups = [];
  for (let i = 0; i < words.length; ) {
    const remaining = words.length - i;
    const take = remaining >= size * 2 + 1 ? size : remaining >= size + 1 ? size + 1 : remaining;
    groups.push(words.slice(i, i + take));
    i += take;
  }
  return groups;
}

function findActiveGroup(groups, frame, fps) {
  for (const group of groups) {
    const start = toFrame(group[0].start, fps);
    const end = toFrame(group[group.length - 1].end, fps);
    if (frame >= start && frame <= end) return group;
  }
  return null;
}

function isWordActive(word, frame, fps) {
  return frame >= toFrame(word.start, fps) && frame <= toFrame(word.end, fps);
}

// ---------------------------------------------------------------------------
// Shared caption container (bottom-center)
// ---------------------------------------------------------------------------

const bottomContainer = {
  position: 'absolute',
  bottom: 80,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const centerContainer = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

// ---------------------------------------------------------------------------
// Style: heat-glow
// ---------------------------------------------------------------------------

function renderHeatGlow(words, frame, fps) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;

  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ ...bottomContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => {
          const active = isWordActive(w, frame, fps);
          return (
            <span
              key={i}
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 72,
                color: active ? '#FF3B30' : '#FFFFFF',
                filter: active ? 'drop-shadow(0 0 20px #FF3B30)' : 'none',
                textShadow: '2px 2px 8px rgba(0,0,0,0.7)',
                transition: 'color 0.05s, filter 0.05s',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style: elegant
// ---------------------------------------------------------------------------

function renderElegant(words, frame, fps) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;

  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ ...bottomContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => {
          const active = isWordActive(w, frame, fps);
          return (
            <span
              key={i}
              style={{
                fontFamily: active
                  ? "'Noto Serif', Georgia, serif"
                  : 'system-ui, sans-serif',
                fontStyle: active ? 'italic' : 'normal',
                fontWeight: active ? 400 : 500,
                fontSize: active ? 80 : 64,
                color: '#FFFFFF',
                filter: active
                  ? 'drop-shadow(0 0 25px rgba(255,255,255,0.9))'
                  : 'none',
                textShadow:
                  '3px 3px 6px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.7)',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style: word-pop
// ---------------------------------------------------------------------------

function renderWordPop(words, frame, fps) {
  // Find the currently active word
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;

  const wordStart = toFrame(active.start, fps);
  const springVal = spring({
    frame: frame - wordStart,
    fps,
    config: { stiffness: 200, damping: 20 },
  });
  const scale = interpolate(springVal, [0, 1], [0.7, 1.0]);

  return (
    <div style={centerContainer}>
      <span
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 120,
          color: '#FFFFFF',
          WebkitTextStroke: '4px black',
          paintOrder: 'stroke fill',
          textShadow: '4px 4px 12px rgba(0,0,0,0.6)',
          transform: `scale(${scale})`,
        }}
      >
        {active.word}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style: cinematic
// ---------------------------------------------------------------------------

function renderCinematic(words, frame, fps) {
  const groups = groupWords(words, 6);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;

  const groupStart = toFrame(group[0].start, fps);
  const groupEnd = toFrame(group[group.length - 1].end, fps);

  const fadeIn = interpolate(frame, [groupStart, groupStart + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [groupEnd - 8, groupEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = fadeIn * fadeOut;

  return (
    <div style={{ ...bottomContainer, opacity }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => (
          <span
            key={i}
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 400,
              fontSize: 58,
              color: '#FFFFFF',
              letterSpacing: '0.02em',
              textShadow: '2px 2px 6px rgba(0,0,0,0.7)',
            }}
          >
            {w.word}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style: emoji-auto (heat-glow base + emoji overlays)
// ---------------------------------------------------------------------------

function renderEmojiAuto(words, frame, fps, emojiCues) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);

  // Render emoji overlays
  const emojiOverlays = (emojiCues || [])
    .filter((cue) => frame >= cue.startFrame && frame <= cue.startFrame + 60)
    .map((cue, i) => {
      const springVal = spring({
        frame: frame - cue.startFrame,
        fps,
        config: { stiffness: 200, damping: 20 },
      });
      const positions = [25, 50, 75];
      const left = positions[i % positions.length];
      return (
        <Video
          key={`emoji-${i}`}
          src={cue.emojiUrl}
          style={{
            mixBlendMode: 'screen',
            width: 120,
            height: 120,
            position: 'absolute',
            top: '30%',
            left: `${left}%`,
            transform: `scale(${springVal}) translate(-50%, -50%)`,
          }}
        />
      );
    });

  // Caption text (same as heat-glow)
  let captionEl = null;
  if (group) {
    const groupStart = toFrame(group[0].start, fps);
    const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    captionEl = (
      <div style={{ ...bottomContainer, opacity: entrance }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {group.map((w, i) => {
            const active = isWordActive(w, frame, fps);
            return (
              <span
                key={i}
                style={{
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: 72,
                  color: active ? '#FF3B30' : '#FFFFFF',
                  filter: active ? 'drop-shadow(0 0 20px #FF3B30)' : 'none',
                  textShadow: '2px 2px 8px rgba(0,0,0,0.7)',
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {emojiOverlays}
      {captionEl}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Composition
// ---------------------------------------------------------------------------

export const CaptionsComposition = ({ videoUrl, words, style, emojiCues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const renderCaptions = () => {
    switch (style) {
      case 'heat-glow':
        return renderHeatGlow(words, frame, fps);
      case 'elegant':
        return renderElegant(words, frame, fps);
      case 'word-pop':
        return renderWordPop(words, frame, fps);
      case 'cinematic':
        return renderCinematic(words, frame, fps);
      case 'emoji-auto':
        return renderEmojiAuto(words, frame, fps, emojiCues);
      default:
        return renderHeatGlow(words, frame, fps);
    }
  };

  return (
    <AbsoluteFill>
      <Video
        src={videoUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <AbsoluteFill>{renderCaptions()}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export default CaptionsComposition;
