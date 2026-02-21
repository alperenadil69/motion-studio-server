import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

const SYSTEM_PROMPT = `You are an expert Remotion developer. Generate clean, professional React/Remotion components.

VISUAL QUALITY RULES (always apply):
- Backgrounds: solid colors only OR radial-gradient with max 2 close shades — NEVER random blobs or ugly gradients
- Typography: system-ui, -apple-system, sans-serif — font-weight 700 for titles, 300 for subtitles
- letter-spacing: -0.02em for titles, 0.05em for subtitles
- Colors: ALWAYS use brand colors provided — never invent colors
- Layout: center everything with flexbox — justifyContent: 'center', alignItems: 'center'
- Whitespace: generous padding (min 80px sides for vertical, 120px for horizontal)

ANIMATION RULES (always apply):
- ALL animations use interpolate() with extrapolateLeft:'clamp', extrapolateRight:'clamp'
- Entrance: opacity 0→1 over 20 frames + translateY 30→0 simultaneously
- Stagger: each element starts 15 frames after the previous
- Scale: always 0.95→1.0, never 0→1 (too dramatic)
- NEVER animate more than 3 elements at once

TECHNICAL RULES:
- NEVER use useState, useEffect, useRef or any React hooks
- ONLY useCurrentFrame(), interpolate(), spring(), Sequence, Img from Remotion
- export default function with PascalCase name
- If images provided: use <Img> with explicit width/height, objectFit:'cover'
- Max 250 lines of code`;

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
