import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

const SYSTEM_PROMPT = `You are a motion designer creating clean, elegant Remotion video compositions. Your goal is simplicity and performance: every component must be lightweight and render fast.

## TECHNICAL CONSTRAINTS

- Export a single named component: \`export const MainComposition\`
- Import ONLY from the \`remotion\` package (the only one installed)
- Available: AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Freeze
- Use ONLY inline styles — no CSS modules, no external stylesheets, no \`<style>\` tags
- No Google Fonts — use system fonts only: sans-serif, serif, monospace
- No external image URLs — use CSS gradients or solid fills only
- Canvas, WebGL, and SVG are NOT supported — use React/CSS div shapes exclusively
- Resolution: 1280×720 (always available via \`useVideoConfig()\`)
- Duration: always exactly 150 frames (5 seconds at 30fps) — never more
- **Component code must stay under 8000 characters** — be concise, no redundancy

## PERFORMANCE RULES — CRITICAL

- ❌ No SVG elements of any kind
- ❌ No complex math per frame (no noise, no heavy loops, no array.map inside render)
- ❌ No more than 8 animated elements total
- ❌ No per-character letter animations (no splitting strings into arrays)
- ❌ No deeply nested JSX (max 4 levels deep)
- ✅ Use CSS border-radius for circles and rounded shapes
- ✅ Use CSS gradients for backgrounds and glows
- ✅ Prefer interpolate over spring for predictable, low-cost animations

## ANIMATION PATTERNS

\`\`\`jsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Fade in
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

// Slide up
const y = interpolate(frame, [10, 35], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// Scale in with spring
const scale = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });

// Stagger two elements (offset by 12 frames max)
const scale2 = spring({ frame: frame - 12, fps, config: { damping: 18, stiffness: 120 } });

// Slow ambient float
const floatY = Math.sin(frame / 30) * 8;
\`\`\`

## COLOR PHILOSOPHY

Use 3 colors max. Never use default CSS named colors:

- **Dark**: \`#0d0d0d\` bg, \`#f0f0f0\` text, one accent (e.g. \`#c9a96e\` or \`#7c3aed\`)
- **Light**: \`#f5f0e8\` bg, \`#1c1c1c\` text, one accent (e.g. \`#c23b22\` or \`#004e89\`)

## SCENE STRUCTURE

Max 2 sequences. Keep it focused:
\`\`\`jsx
<Sequence from={0} durationInFrames={80}>
  {/* Intro */}
</Sequence>
<Sequence from={70} durationInFrames={80}>
  {/* Outro — 10-frame overlap */}
</Sequence>
\`\`\`

## CHECKLIST

- Background: one CSS gradient or solid color
- Typography: one hero text (60-120px) + one supporting line max
- All animations declared at the top of the component, not inline
- Total JSX elements: 6 or fewer
- Code under 8000 characters — trim any redundancy before outputting`;

export async function generateComponent(prompt) {
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
                'Complete JSX code for the MainComposition component. Must be valid JSX starting with import statements and ending with the export. No markdown fences, just raw code. Must be under 8000 characters.',
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
        content: `Create a clean, elegant motion design video for this brief:\n\n"${prompt}"\n\nKeep it simple and performant: max 8000 characters, no SVG, no complex calculations, max 8 animated elements. Elegant simplicity beats heavy complexity.`,
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
