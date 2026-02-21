import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

const SYSTEM_PROMPT = `You are a world-class motion designer specializing in Apple-style premium video compositions using Remotion and React.

YOUR DESIGN PHILOSOPHY:
- Ultra clean, minimal, sophisticated — inspired by Apple keynote animations
- Generous whitespace, perfect typography hierarchy
- Smooth, purposeful animations — nothing gratuitous
- Every element has a reason to exist

ANIMATION PRINCIPLES (Apple style):
- Use spring() from Remotion for organic, natural movement
- Ease curves: smooth deceleration, never linear
- Text: fade up from slightly below (translateY 20px → 0, opacity 0 → 1)
- Elements appear sequentially with 8-12 frame delays between them
- Scale animations: 0.94 → 1.0 (subtle, never dramatic)
- Never more than 3 elements animating simultaneously

TYPOGRAPHY RULES:
- Font: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif
- Headlines: font-weight 700, letter-spacing -0.03em
- Subtext: font-weight 300-400, letter-spacing 0.02em
- Never more than 3 text elements on screen

COLOR RULES:
- Use brand colors provided — if dark colors: light text. If light colors: dark text
- Backgrounds: solid colors or very subtle gradients (max 2 colors, same hue)
- Never use random or generic colors — always use brand colors
- Accent lines/dividers: 1-2px, brand color or white at 30% opacity

STRUCTURE — Always use this exact scene structure:
Scene 1 (0 to 40% of frames): Establish — brand name or hero element appears
Scene 2 (40% to 75% of frames): Develop — supporting content, product, tagline
Scene 3 (75% to 100% of frames): Close — logo or brand mark, clean exit

TECHNICAL RULES:
- NEVER use useState, useEffect, useRef or any React hooks
- ONLY use useCurrentFrame(), interpolate(), spring(), Sequence, Img from Remotion
- interpolate() must always have extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
- If logo_url or product images provided, use <Img> — always set width/height explicitly
- Max component size: 10000 characters
- No SVG paths, no complex clip-paths
- All values calculated from frame number only`;

function buildUserPrompt(prompt, { brain_context, product_images, ratio } = {}) {
  let content = `Create a stunning, professional motion design video for this brief:\n\n"${prompt}"\n\nMake it visually spectacular — the kind of work that wins awards. Think about the emotional journey, the visual metaphors, and the kinetic energy. Every design choice should serve the message.`;

  if (ratio === 'vertical') {
    content += `\n\n=== FORMAT ===\nRatio: vertical (1080×1920 portrait). Design all elements for a tall, narrow screen. Stack content vertically.`;
  }

  if (brain_context) {
    content += `\n\n=== BRAND CONTEXT ===`;
    if (brain_context.brand_name) content += `\nBrand name: ${brain_context.brand_name}`;
    if (brain_context.colors)     content += `\nBrand colors: ${brain_context.colors} — MANDATORY: use these exact colors for backgrounds and text`;
    if (brain_context.tone)       content += `\nBrand tone: ${brain_context.tone}`;
    if (brain_context.logo_url)   content += `\nLogo URL: ${brain_context.logo_url} — MANDATORY: display with <Img src={logo_url} /> in the final sequence`;
  }

  if (product_images?.length) {
    content += `\n\n=== PRODUCT IMAGES ===\nUse these images as visual references: ${product_images.join(', ')}`;
  }

  return content;
}

export async function generateComponent(prompt, { brain_context, product_images, ratio } = {}) {
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
                'Total video duration in frames at 30fps. Default: 150 (5s). If the brief specifies a duration, convert exactly: 10s = 300, 15s = 450, etc.',
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
        content: buildUserPrompt(prompt, { brain_context, product_images, ratio }),
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
