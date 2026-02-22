import React from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { loadFont } from '@remotion/fonts';

// ---------------------------------------------------------------------------
// Font loading
// ---------------------------------------------------------------------------

loadFont({ family: 'Noto Serif', url: 'https://fonts.gstatic.com/s/notoserif/v23/ga6Iaw1J5X9T9RW6j9bNfFImZzC7TMQ.woff2' });
loadFont({ family: 'Playfair Display', url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vUDQZNLo_U2r.woff2' });
loadFont({ family: 'Dancing Script', url: 'https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup6hNX6plRP.woff2' });
loadFont({ family: 'Oswald', url: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiYA.woff2' });
loadFont({ family: 'Bebas Neue', url: 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXooxW5rygbi49c.woff2' });
loadFont({ family: 'Courier Prime', url: 'https://fonts.gstatic.com/s/courierprime/v9/u-450q2lgwslOqpF_6gQ8kELWwZjW-_-tvg.woff2' });
loadFont({ family: 'Montserrat', url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2' });
loadFont({ family: 'Poppins', url: 'https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.woff2' });
loadFont({ family: 'Cinzel', url: 'https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnTYrvDE5ZdqU.woff2' });
loadFont({ family: 'Caveat', url: 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SIKjYBxPigs.woff2' });

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

function findCurrentActiveWord(group, frame, fps) {
  return [...group].reverse().find((w) => toFrame(w.start, fps) <= frame);
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

// ---------------------------------------------------------------------------
// Shared containers
// ---------------------------------------------------------------------------

const bottomContainer = {
  position: 'absolute', bottom: 80, left: 0, right: 0,
  display: 'flex', justifyContent: 'center', alignItems: 'center',
};

const centerContainer = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex', justifyContent: 'center', alignItems: 'center',
};

const topContainer = {
  position: 'absolute', top: 80, left: 0, right: 0,
  display: 'flex', justifyContent: 'center', alignItems: 'center',
};

// ===========================================================================
// 1. heat-glow
// ===========================================================================
function renderHeatGlow(words, frame, fps) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = isWordActive(w, frame, fps);
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 72, color: active ? '#EF4444' : '#FFFFFF', filter: active ? 'drop-shadow(0 0 20px #EF4444)' : 'none', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 2. elegant
// ===========================================================================
function renderElegant(words, frame, fps) {
  let activeIdx = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (toFrame(words[i].start, fps) <= frame) { activeIdx = i; break; }
  }
  if (activeIdx === -1) return null;
  const windowStart = Math.max(0, activeIdx - 4);
  const windowEnd = Math.min(words.length, windowStart + 8);
  const win = words.slice(windowStart, windowEnd);
  const line1 = win.slice(0, 4);
  const line2 = win.slice(4);
  const groupStart = toFrame(win[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  const renderWord = (w, i) => {
    const active = words.indexOf(w) === activeIdx;
    return (<span key={i} style={{ fontFamily: active ? "'Noto Serif', serif" : 'system-ui, sans-serif', fontStyle: active ? 'italic' : 'normal', fontWeight: active ? 400 : 700, fontSize: active ? 82 : 72, color: '#FFFFFF', filter: active ? 'drop-shadow(0 0 20px white) drop-shadow(0 0 50px rgba(255,255,255,0.8))' : 'none', textShadow: active ? 'none' : '0 2px 12px rgba(0,0,0,0.9)', marginRight: 16 }}>{w.word}</span>);
  };
  const lineStyle = { display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 12 };
  return (
    <div style={{ position: 'absolute', top: '70%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: entrance }}>
      <div style={lineStyle}>{line1.map(renderWord)}</div>
      {line2.length > 0 && <div style={lineStyle}>{line2.map(renderWord)}</div>}
    </div>
  );
}

// ===========================================================================
// 3. word-pop
// ===========================================================================
function renderWordPop(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const springVal = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(springVal, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 900, fontSize: 120, color: '#FFFFFF', WebkitTextStroke: '4px black', paintOrder: 'stroke fill', textShadow: '4px 4px 12px rgba(0,0,0,0.6)', transform: `scale(${scale})` }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 4. cinematic
// ===========================================================================
function renderCinematic(words, frame, fps) {
  const groups = groupWords(words, 6);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const groupEnd = toFrame(group[group.length - 1].end, fps);
  const fadeIn = interpolate(frame, [groupStart, groupStart + 12], [0, 1], clamp);
  const fadeOut = interpolate(frame, [groupEnd - 8, groupEnd], [1, 0], clamp);
  return (
    <div style={{ ...bottomContainer, opacity: fadeIn * fadeOut }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400, fontSize: 58, color: '#FFFFFF', letterSpacing: '0.02em', textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 5. emoji-auto
// ===========================================================================
function renderEmojiAuto(words, frame, fps, emojiCues) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  const emojiOverlays = (emojiCues || [])
    .filter((cue) => frame >= cue.startFrame && frame <= cue.startFrame + 60)
    .map((cue, i) => {
      const sv = spring({ frame: frame - cue.startFrame, fps, config: { stiffness: 200, damping: 20 } });
      const positions = [25, 50, 75];
      return (<Video key={`emoji-${i}`} src={cue.emojiUrl} style={{ mixBlendMode: 'screen', width: 120, height: 120, position: 'absolute', top: '30%', left: `${positions[i % 3]}%`, transform: `scale(${sv}) translate(-50%, -50%)` }} />);
    });
  let captionEl = null;
  if (group) {
    const groupStart = toFrame(group[0].start, fps);
    const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
    captionEl = (
      <div style={{ ...bottomContainer, opacity: entrance }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {group.map((w, i) => {
            const active = isWordActive(w, frame, fps);
            return (<span key={i} style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 800, fontSize: 72, color: active ? '#FF3B30' : '#FFFFFF', filter: active ? 'drop-shadow(0 0 20px #FF3B30)' : 'none', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
          })}
        </div>
      </div>
    );
  }
  return (<>{emojiOverlays}{captionEl}</>);
}

// ===========================================================================
// 6. heat
// ===========================================================================
function renderHeat(words, frame, fps) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = isWordActive(w, frame, fps);
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 60, color: active ? '#EF4444' : '#FFFFFF', textShadow: active ? '0 0 12px rgba(239,68,68,0.5), 2px 2px 8px rgba(0,0,0,0.7)' : '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 7. zodiac
// ===========================================================================
function renderZodiac(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ background: '#1E293B', padding: '18px 36px', borderRadius: 12, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: 54, color: '#C9A84C', textTransform: 'uppercase', textShadow: '0 4px 8px rgba(0,0,0,0.5)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 8. hustle-v3
// ===========================================================================
function renderHustleV3(words, frame, fps) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', transform: 'rotate(-3deg)', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 60, color: active ? '#FACC15' : '#EF4444', textTransform: 'uppercase', transform: active ? 'scale(1.3)' : 'scale(1)', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 9. orion
// ===========================================================================
function renderOrion(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.6, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 100, textTransform: 'uppercase', color: '#22C55E', transform: `scale(${scale})`, textShadow: '0 0 10px rgba(34,197,94,0.5), 2px 2px 4px rgba(0,0,0,0.3)' }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 10. cove
// ===========================================================================
function renderCove(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: active ? "'Dancing Script', cursive" : "'Poppins', sans-serif", fontWeight: active ? 700 : 400, fontSize: active ? 72 : 48, color: '#FFFFFF', textShadow: active ? '0 0 15px rgba(255,255,255,0.6), 2px 2px 8px rgba(0,0,0,0.7)' : '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 11. magazine
// ===========================================================================
function renderMagazine(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 54, color: active ? '#E2E860' : '#FFFFFF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 12. betelgeuse
// ===========================================================================
function renderBetelgeuse(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 250, damping: 18 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 900, fontSize: 100, color: '#1E3A8A', textTransform: 'uppercase', WebkitTextStroke: '4px white', paintOrder: 'stroke fill', transform: `scale(${scale})` }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 13. daily-mail
// ===========================================================================
function renderDailyMail(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  const line1 = group.slice(0, 3);
  const line2 = group.slice(3);
  const renderLine = (lineWords) => (
    <div style={{ background: '#1E1B4B', padding: '10px 20px', borderRadius: 6, display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
      {lineWords.map((w, i) => {
        const active = activeWord && w === activeWord;
        const past = toFrame(w.end, fps) < frame;
        return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 52, color: (active || past) ? '#FFFFFF' : '#9CA3AF' }}>{w.word}</span>);
      })}
    </div>
  );
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        {renderLine(line1)}
        {line2.length > 0 && renderLine(line2)}
      </div>
    </div>
  );
}

// ===========================================================================
// 14. eclipse
// ===========================================================================
function renderEclipse(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  const line1 = group.slice(0, 3);
  const line2 = group.slice(3);
  const renderLine = (lineWords) => (
    <div style={{ background: '#2D1B69', padding: '10px 20px', borderRadius: 6, display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
      {lineWords.map((w, i) => {
        const active = activeWord && w === activeWord;
        return (<span key={i} style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400, fontSize: 48, color: active ? '#FFFFFF' : '#D1D5DB' }}>{w.word}</span>);
      })}
    </div>
  );
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        {renderLine(line1)}
        {line2.length > 0 && renderLine(line2)}
      </div>
    </div>
  );
}

// ===========================================================================
// 15. suzy
// ===========================================================================
function renderSuzy(words, frame, fps) {
  const groups = groupWords(words, 6);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 48, color: '#F59E0B', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 16. milky-way
// ===========================================================================
function renderMilkyWay(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.6, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: '#7C3AED', padding: '18px 40px', borderRadius: 14, transform: `scale(${scale})`, boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 90, color: '#22C55E', textTransform: 'uppercase' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 17. vitamin-c
// ===========================================================================
function renderVitaminC(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 250, damping: 18 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: 'linear-gradient(45deg, #F59E0B, #EC4899)', padding: '14px 36px', borderRadius: 12, transform: `scale(${scale})`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 68, textTransform: 'uppercase', color: '#F3F4F6' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 18. alcyone
// ===========================================================================
function renderAlcyone(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 80, color: '#FFFFFF', textTransform: 'uppercase', textShadow: '0 0 20px rgba(167,139,250,0.7), 0 0 40px rgba(167,139,250,0.4)', transform: `scale(${scale})` }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 19. buzz
// ===========================================================================
function renderBuzz(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 250, damping: 18 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: '#FACC15', padding: '14px 36px', borderRadius: 10, transform: `scale(${scale})`, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 72, textTransform: 'uppercase', color: '#000000' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 20. thuban
// ===========================================================================
function renderThuban(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 250, damping: 18 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: '#FACC15', padding: '12px 32px', borderRadius: 10, transform: `rotate(-5deg) scale(${scale})`, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 68, textTransform: 'uppercase', color: '#000000' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 21. marigold
// ===========================================================================
function renderMarigold(words, frame, fps) {
  const groups = groupWords(words, 6);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 48, color: '#F59E0B', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 22. closed-cap
// ===========================================================================
function renderClosedCap(words, frame, fps) {
  const groups = groupWords(words, 6);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 4], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: entrance }}>
      <div style={{ background: 'rgba(0,0,0,0.8)', padding: '10px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '85%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 400, fontSize: 40, color: '#FFFFFF' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 23. note
// ===========================================================================
function renderNote(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 52, color: '#FFFFFF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 24. poem
// ===========================================================================
function renderPoem(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const fadeIn = interpolate(frame, [wordStart, wordStart + 6], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: fadeIn }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 52, color: '#94A3B8', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 25. energy
// ===========================================================================
function renderEnergy(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 250, damping: 18 } });
  const scale = interpolate(sv, [0, 1], [0.8, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: '#F3F4F6', padding: '18px 40px', borderRadius: 16, transform: `scale(${scale})`, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 64, color: '#374151', textTransform: 'lowercase' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 26. recess
// ===========================================================================
function renderRecess(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.6, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 100, textTransform: 'uppercase', color: '#FFFFFF', transform: `scale(${scale})`, textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 27. messages
// ===========================================================================
function renderMessages(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.8, 1.0]);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 60 }}>
      <div style={{ background: '#3B82F6', padding: '12px 24px', borderRadius: 22, transform: `scale(${scale})` }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: 36, color: '#FFFFFF' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 28. mizar
// ===========================================================================
function renderMizar(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 80, textTransform: 'uppercase', color: '#7C3AED', textShadow: '0 0 15px rgba(124,58,237,0.6)', transform: `scale(${scale})` }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 29. pulse
// ===========================================================================
function renderPulse(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 56, textTransform: 'uppercase', color: active ? '#84CC16' : '#FFFFFF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 30. linear
// ===========================================================================
function renderLinear(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: '#1E1B4B', padding: '16px 36px', borderRadius: 12, transform: `scale(${scale})` }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 64, textTransform: 'uppercase', color: '#22C55E' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 31. cartwheel-black
// ===========================================================================
function renderCartwheelBlack(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 60, textTransform: 'uppercase', color: active ? '#FACC15' : '#A855F7', transform: active ? 'scale(1.3)' : 'scale(1)', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 32. footprint-v3
// ===========================================================================
function renderFootprintV3(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  const rotatingColors = ['#EF4444', '#FBBF24', '#10B981', '#3B82F6', '#A855F7'];
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 60, textTransform: 'uppercase', color: active ? rotatingColors[i % 5] : '#FFFFFF', transform: active ? 'scale(1.2)' : 'scale(1)', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 33. andromeda
// ===========================================================================
function renderAndromeda(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 56, color: active ? '#C084FC' : '#E9D5FF', filter: active ? 'drop-shadow(0 0 16px #C084FC)' : 'none', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 34. baseline
// ===========================================================================
function renderBaseline(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 52, color: active ? '#FFFFFF' : '#9CA3AF', textDecoration: active ? 'underline' : 'none', textDecorationColor: '#FFFFFF', textUnderlineOffset: 8, textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 35. cartwheel-purple
// ===========================================================================
function renderCartwheelPurple(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <div style={{ background: '#7C3AED', padding: '16px 36px', borderRadius: 12, transform: `scale(${scale})`, boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 72, textTransform: 'uppercase', color: '#FFFFFF' }}>{active.word}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// 36. arion-pink
// ===========================================================================
function renderArionPink(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 60, color: active ? '#EC4899' : '#FBCFE8', filter: active ? 'drop-shadow(0 0 16px #EC4899)' : 'none', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 37. castor
// ===========================================================================
function renderCastor(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 56, color: '#FFFFFF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 38. techwave
// ===========================================================================
function renderTechwave(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 54, textTransform: 'uppercase', color: '#FFFFFF', textShadow: '2px 2px 0px rgba(0,0,0,0.3), 4px 4px 0px rgba(0,0,0,0.2)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 39. flair
// ===========================================================================
function renderFlair(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: active ? 700 : 400, fontStyle: active ? 'italic' : 'normal', fontSize: 54, color: '#FFFFFF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 40. aries
// ===========================================================================
function renderAries(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  const line1 = group.slice(0, 3);
  const line2 = group.slice(3);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 60, opacity: entrance }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {[line1, line2].filter(l => l.length).map((line, li) => (
          <div key={li} style={{ display: 'flex', gap: 12 }}>
            {line.map((w, i) => {
              const active = activeWord && w === activeWord;
              return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: active ? 800 : 600, fontSize: 54, color: active ? '#FFFFFF' : '#9CA3AF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// 41. dimidium
// ===========================================================================
function renderDimidium(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ maxWidth: '80%', display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: active ? 700 : 400, fontStyle: 'italic', fontSize: 56, color: active ? '#84CC16' : '#D1D5DB', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 42. fuel
// ===========================================================================
function renderFuel(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 60, textTransform: 'uppercase', color: active ? '#000000' : '#FFFFFF', background: active ? '#22C55E' : 'transparent', padding: active ? '4px 14px' : 0, borderRadius: active ? 8 : 0, textShadow: active ? 'none' : '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 43. orbitar-black
// ===========================================================================
function renderOrbitarBlack(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 60, textTransform: 'uppercase', color: active ? '#FACC15' : '#FFFFFF', transform: active ? 'scale(1.2)' : 'scale(1)', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 44. vitamin-b
// ===========================================================================
function renderVitaminB(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: active ? 800 : 400, fontSize: active ? 80 : 48, color: active ? '#FFFFFF' : '#9CA3AF', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 45. lumin
// ===========================================================================
function renderLumin(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  const activeWord = findCurrentActiveWord(group, frame, fps);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => {
          const active = activeWord && w === activeWord;
          return (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 56, color: '#FFFFFF', textShadow: active ? '0 0 10px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.5), 2px 2px 8px rgba(0,0,0,0.7)' : '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>);
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 46. bold
// ===========================================================================
function renderBold(words, frame, fps) {
  const active = words.find((w) => isWordActive(w, frame, fps));
  if (!active) return null;
  const wordStart = toFrame(active.start, fps);
  const sv = spring({ frame: frame - wordStart, fps, config: { stiffness: 200, damping: 20 } });
  const scale = interpolate(sv, [0, 1], [0.7, 1.0]);
  return (
    <div style={centerContainer}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 100, textTransform: 'uppercase', color: '#FFFFFF', WebkitTextStroke: '3px black', paintOrder: 'stroke fill', transform: `scale(${scale})` }}>{active.word}</span>
    </div>
  );
}

// ===========================================================================
// 47. minimal
// ===========================================================================
function renderMinimal(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ background: 'rgba(0,0,0,0.5)', padding: '12px 24px', borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 44, color: '#FFFFFF' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 48. neon
// ===========================================================================
function renderNeon(words, frame, fps) {
  const groups = groupWords(words, 4);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const entrance = interpolate(frame, [groupStart, groupStart + 6], [0, 1], clamp);
  return (
    <div style={{ ...centerContainer, opacity: entrance }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 60, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.3em', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// 49. elegant-classic
// ===========================================================================
function renderElegantClassic(words, frame, fps) {
  const groups = groupWords(words, 5);
  const group = findActiveGroup(groups, frame, fps);
  if (!group) return null;
  const groupStart = toFrame(group[0].start, fps);
  const groupEnd = toFrame(group[group.length - 1].end, fps);
  const fadeIn = interpolate(frame, [groupStart, groupStart + 8], [0, 1], clamp);
  const fadeOut = interpolate(frame, [groupEnd - 6, groupEnd], [1, 0], clamp);
  return (
    <div style={{ ...centerContainer, opacity: fadeIn * fadeOut }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80%' }}>
        {group.map((w, i) => (<span key={i} style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 48, color: '#E2E8F0', textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{w.word}</span>))}
      </div>
    </div>
  );
}

// ===========================================================================
// Main Composition
// ===========================================================================

export const CaptionsComposition = ({ videoUrl, words, style, emojiCues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const renderCaptions = () => {
    switch (style) {
      case 'heat-glow': return renderHeatGlow(words, frame, fps);
      case 'elegant': return renderElegant(words, frame, fps);
      case 'word-pop': return renderWordPop(words, frame, fps);
      case 'cinematic': return renderCinematic(words, frame, fps);
      case 'emoji-auto': return renderEmojiAuto(words, frame, fps, emojiCues);
      case 'heat': return renderHeat(words, frame, fps);
      case 'zodiac': return renderZodiac(words, frame, fps);
      case 'hustle-v3': return renderHustleV3(words, frame, fps);
      case 'orion': return renderOrion(words, frame, fps);
      case 'cove': return renderCove(words, frame, fps);
      case 'magazine': return renderMagazine(words, frame, fps);
      case 'betelgeuse': return renderBetelgeuse(words, frame, fps);
      case 'daily-mail': return renderDailyMail(words, frame, fps);
      case 'eclipse': return renderEclipse(words, frame, fps);
      case 'suzy': return renderSuzy(words, frame, fps);
      case 'milky-way': return renderMilkyWay(words, frame, fps);
      case 'vitamin-c': return renderVitaminC(words, frame, fps);
      case 'alcyone': return renderAlcyone(words, frame, fps);
      case 'buzz': return renderBuzz(words, frame, fps);
      case 'thuban': return renderThuban(words, frame, fps);
      case 'marigold': return renderMarigold(words, frame, fps);
      case 'closed-cap': return renderClosedCap(words, frame, fps);
      case 'note': return renderNote(words, frame, fps);
      case 'poem': return renderPoem(words, frame, fps);
      case 'energy': return renderEnergy(words, frame, fps);
      case 'recess': return renderRecess(words, frame, fps);
      case 'messages': return renderMessages(words, frame, fps);
      case 'mizar': return renderMizar(words, frame, fps);
      case 'pulse': return renderPulse(words, frame, fps);
      case 'linear': return renderLinear(words, frame, fps);
      case 'cartwheel-black': return renderCartwheelBlack(words, frame, fps);
      case 'footprint-v3': return renderFootprintV3(words, frame, fps);
      case 'andromeda': return renderAndromeda(words, frame, fps);
      case 'baseline': return renderBaseline(words, frame, fps);
      case 'cartwheel-purple': return renderCartwheelPurple(words, frame, fps);
      case 'arion-pink': return renderArionPink(words, frame, fps);
      case 'castor': return renderCastor(words, frame, fps);
      case 'techwave': return renderTechwave(words, frame, fps);
      case 'flair': return renderFlair(words, frame, fps);
      case 'aries': return renderAries(words, frame, fps);
      case 'dimidium': return renderDimidium(words, frame, fps);
      case 'fuel': return renderFuel(words, frame, fps);
      case 'orbitar-black': return renderOrbitarBlack(words, frame, fps);
      case 'vitamin-b': return renderVitaminB(words, frame, fps);
      case 'lumin': return renderLumin(words, frame, fps);
      case 'bold': return renderBold(words, frame, fps);
      case 'minimal': return renderMinimal(words, frame, fps);
      case 'neon': return renderNeon(words, frame, fps);
      case 'elegant-classic': return renderElegantClassic(words, frame, fps);
      default: return renderHeatGlow(words, frame, fps);
    }
  };

  return (
    <AbsoluteFill>
      <Video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <AbsoluteFill>{renderCaptions()}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export default CaptionsComposition;
