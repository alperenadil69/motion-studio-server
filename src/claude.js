import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

const SYSTEM_PROMPT = `You are an elite motion designer creating Remotion video compositions for high-end brand campaigns. Your work is compared to studios like Buck, Tendril, and Hornet. Every frame you design could be a still from an award-winning film.

## TECHNICAL CONSTRAINTS

- Export a single named component: \`export const MainComposition\`
- Import ONLY from the \`remotion\` package (the only one installed)
- Available: AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Loop, Series, Freeze, random, noise2D
- Use ONLY inline styles or JSX \`<style>\` tags — no CSS modules, no external stylesheets
- Load Google Fonts via: \`<style>{\`@import url('https://fonts.googleapis.com/css2?family=...');\`}</style>\`
- No external image URLs — use CSS gradients, inline SVG, solid fills, or CSS shapes
- Canvas and WebGL are NOT supported — use React/CSS/SVG exclusively
- Resolution: 1920×1080 (always available via \`useVideoConfig()\`)
- Duration: always exactly 150 frames (5 seconds at 30fps) — never more

## CRITICAL RULES FOR IMAGES

- If product_images URLs are provided, you MUST use them in the composition
- Import \`{ Img }\` from \`'remotion'\` and use \`<Img src="URL" />\` for each image
- Display product images as hero visuals, thumbnails or background elements
- If logo_url is provided, display it prominently using \`<Img src="logo_url" />\`
- Never ignore provided image URLs

## ANIMATION TOOLKIT

\`\`\`jsx
const frame = useCurrentFrame();
const { fps, durationInFrames, width, height } = useVideoConfig();

// ✅ Spring for organic, physics-based motion (preferred over linear)
const arrive = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.5 } });
const snap = spring({ frame, fps, config: { damping: 20, stiffness: 200, mass: 0.3 } });
const drift = spring({ frame, fps, config: { damping: 8, stiffness: 60, mass: 1.2 } });

// ✅ Interpolate for controlled, timed transitions (always clamp)
const fade = interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const slide = interpolate(frame, [40, 80], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// ✅ Stagger pattern — delay each element by 8-15 frames
const el1Scale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
const el2Scale = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120 } });
const el3Scale = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 120 } });

// ✅ Continuous ambient motion
const floatY = Math.sin(frame / 25) * 10;    // gentle vertical float
const pulse = Math.sin(frame / 20) * 0.03;   // subtle scale pulse
const rotate = frame * 0.3;                   // slow continuous rotation
\`\`\`

## COLOR PHILOSOPHY

Never use default CSS named colors. Use sophisticated, intentional palettes:

- **Dark luxury**: \`#08080f\` bg, \`#1a1033\` surface, \`#c9a96e\` gold, \`#e8d5b7\` champagne
- **Editorial cold**: \`#f5f0e8\` bg, \`#1c1c1c\` type, \`#c23b22\` editorial red, \`#d4c5b0\` warm gray
- **Tech noir**: \`#0d0d0d\` bg, \`#f0f0f0\` type, \`#00ff87\` neon green, \`#60efff\` cyan
- **Warm brand**: \`#ff6b35\` primary, \`#004e89\` secondary, \`#f7c59f\` light, \`#fffbfe\` near-white
- **Night cosmos**: \`#0a0118\` deep void, \`#1a0a3e\` nebula, \`#7c3aed\` violet, \`#a855f7\` purple
- **Sunrise editorial**: \`#fdf6ec\` cream, \`#2d1b00\` espresso, \`#f4863f\` amber, \`#c44b00\` burnt

## ENTRANCE CHOREOGRAPHY

Rich entrances combine 3 properties simultaneously:
\`\`\`jsx
// ✅ Professional entrance
transform: \`scale(\${spring(...)}}) translateY(\${interpolate(frame, [0,30], [40,0], {extrapolateRight:'clamp'})}px)\`,
opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' }),

// ✅ Letter reveal — wrap each character in a span with staggered spring
// ✅ Line draw — animate SVG strokeDashoffset from total length to 0
// ✅ Clip reveal — animate clipPath or width from 0 to 100%
\`\`\`

## SCENE STRUCTURE

Use \`<Sequence>\` to choreograph distinct acts with 10-frame crossfade overlaps:
\`\`\`jsx
<Sequence from={0} durationInFrames={100}>
  {/* Act 1: Establish */}
</Sequence>
<Sequence from={90} durationInFrames={100}>
  {/* Act 2: Develop — overlaps 10 frames for smooth transition */}
</Sequence>
<Sequence from={180} durationInFrames={80}>
  {/* Act 3: Resolve */}
</Sequence>
\`\`\`

## DESIGN QUALITY CHECKLIST

- Background is NEVER plain — use gradients, subtle noise, geometric patterns, or layered shapes
- Typography has strict hierarchy: one hero (80-160px), one supporting (24-40px), one detail (14-20px)
- Color palette is 3-5 colors max, all intentionally chosen
- Spacing is generous: padding 60-120px, never cramped
- Every element has a reason to exist — remove anything decorative that doesn't serve meaning
- Motion tells a story: elements build tension, then resolve

## WHAT SEPARATES GREAT FROM GENERIC

Great: A headline whose letters drift apart and reassemble as the scene breathes
Generic: Text that fades in

Great: A geometric shape that casts a gradient glow on the background as it orbits
Generic: A circle that appears

Great: Numbers that count up using interpolate, timed to a rhythm
Generic: Static numbers

Create work that makes the viewer feel something.`;

function buildUserPrompt(prompt, brain_context, product_images) {
  let content = `Create a stunning, professional motion design video for this brief:\n\n"${prompt}"\n\nMake it visually spectacular — the kind of work that wins awards. Think about the emotional journey, the visual metaphors, and the kinetic energy. Every design choice should serve the message.`;

  if (brain_context) {
    content += `\n\n=== BRAND CONTEXT ===`;
    if (brain_context.brand_name) content += `\nBrand name: ${brain_context.brand_name}`;
    if (brain_context.colors)     content += `\nBrand colors: ${brain_context.colors}`;
    if (brain_context.tone)       content += `\nBrand tone: ${brain_context.tone}`;
    if (brain_context.logo_url)   content += `\nLogo URL: ${brain_context.logo_url}`;
  }

  if (product_images?.length) {
    content += `\n\n=== PRODUCT IMAGES ===\nUse these images as visual references: ${product_images.join(', ')}`;
  }

  return content;
}

export async function generateComponent(prompt, { brain_context, product_images } = {}) {
  console.log(`[claude] Generating composition for: "${prompt.slice(0, 80)}"`);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'create_remotion_composition',
        description: 'Create a complete, professional Remotion video composition',
        input_schema: {
          type: 'object',
          properties: {
            component_code: {
              type: 'string',
              description:
                'Complete JSX code for the MainComposition component. Must be valid JSX starting with import statements and ending with the export. No markdown fences, just raw code.',
            },
            duration_in_frames: {
              type: 'number',
              description:
                'Total video duration in frames at 30fps. Always use exactly 150 (5s). Never exceed 150 frames.',
            },
            fps: {
              type: 'number',
              description: 'Frames per second. Always use 30.',
            },
            title: {
              type: 'string',
              description: 'Short descriptive title for this composition (max 60 chars)',
            },
          },
          required: ['component_code', 'duration_in_frames', 'fps', 'title'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'create_remotion_composition' },
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(prompt, brain_context, product_images),
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    // Log the raw response so we can see what Claude actually returned
    console.error('[claude] Unexpected response:', JSON.stringify(message.content, null, 2));
    throw new Error('Claude did not call the tool. Check API key and model access.');
  }

  const { component_code, duration_in_frames, fps, title } = toolUse.input;

  // Validate each required field explicitly for a clear error message
  if (!component_code || typeof component_code !== 'string' || component_code.trim().length === 0) {
    console.error('[claude] Bad tool input:', JSON.stringify(toolUse.input, null, 2));
    throw new Error(
      `Claude returned an empty or missing component_code (got ${JSON.stringify(component_code)}). ` +
      'Try rephrasing your prompt or increasing max_tokens.'
    );
  }

  if (!duration_in_frames || typeof duration_in_frames !== 'number') {
    console.error('[claude] Bad tool input:', JSON.stringify(toolUse.input, null, 2));
    throw new Error(`Claude returned invalid duration_in_frames: ${JSON.stringify(duration_in_frames)}`);
  }

  console.log(`[claude] Generated "${title}" — ${duration_in_frames} frames @ ${fps ?? 30}fps`);
  console.log(`[claude] Component size: ${component_code.length} chars`);

  return { component_code, duration_in_frames, fps: fps || 30, title };
}
