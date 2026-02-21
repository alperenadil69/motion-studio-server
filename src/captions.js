import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';

const execFileAsync = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// ASS helpers
// ---------------------------------------------------------------------------

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function groupWords(words) {
  const groups = [];
  for (let i = 0; i < words.length;) {
    const remaining = words.length - i;
    // If taking 3 would leave exactly 1 orphan, take 4 instead
    const size = remaining >= 7 ? 3 : remaining >= 4 ? 4 : remaining;
    groups.push(words.slice(i, i + size));
    i += size;
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Style definitions — ASS colours are &HAABBGGRR
// ---------------------------------------------------------------------------
const STYLE_DEFS = {
  heat: {
    fontsize: 52, bold: 1, italic: 0,
    primaryColour: '&H00FFFFFF',
    outlineColour: '&H00000000',
    backColour: '&H00000000',
    outline: 2, shadow: 1, borderStyle: 1,
    alignment: 2, marginV: 60,
    highlight: '&H000000FF', // red
  },
  bold: {
    fontsize: 72, bold: 1, italic: 0,
    primaryColour: '&H00FFFFFF',
    outlineColour: '&H00000000',
    backColour: '&H00000000',
    outline: 3, shadow: 2, borderStyle: 1,
    alignment: 5, marginV: 30,
    highlight: null,
    uppercase: true,
  },
  minimal: {
    fontsize: 40, bold: 0, italic: 0,
    primaryColour: '&H00FFFFFF',
    outlineColour: '&H00000000',
    backColour: '&H80000000',
    outline: 0, shadow: 0, borderStyle: 3,
    alignment: 2, marginV: 50,
    highlight: null,
  },
  neon: {
    fontsize: 52, bold: 1, italic: 0,
    primaryColour: '&H00FFFFFF',
    outlineColour: '&H00000000',
    backColour: '&H00000000',
    outline: 2, shadow: 1, borderStyle: 1,
    alignment: 2, marginV: 60,
    highlight: '&H0000FFFF', // yellow
  },
  elegant: {
    fontsize: 44, bold: 0, italic: 1,
    primaryColour: '&H00FFFFFF',
    outlineColour: '&H00000000',
    backColour: '&H00000000',
    outline: 1, shadow: 0, borderStyle: 1,
    alignment: 2, marginV: 60,
    highlight: null,
  },
};

function generateAss(words, style) {
  const def = STYLE_DEFS[style] || STYLE_DEFS.heat;
  const groups = groupWords(words);

  let ass = `[Script Info]
Title: Captions
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${def.fontsize},${def.primaryColour},&H00000000,${def.outlineColour},${def.backColour},${def.bold},${def.italic},0,0,100,100,0,0,${def.borderStyle},${def.outline},${def.shadow},${def.alignment},40,40,${def.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const group of groups) {
    const groupStart = group[0].start;
    const groupEnd = group[group.length - 1].end;

    if (def.highlight) {
      // One dialogue line per word — active word gets highlight colour
      for (let w = 0; w < group.length; w++) {
        const wStart = formatAssTime(group[w].start);
        const wEnd = formatAssTime(
          w < group.length - 1 ? group[w + 1].start : groupEnd,
        );
        const text = group
          .map((g, idx) => {
            const word = def.uppercase ? g.word.toUpperCase() : g.word;
            return idx === w
              ? `{\\c${def.highlight}}${word}{\\c${def.primaryColour}}`
              : word;
          })
          .join(' ');
        ass += `Dialogue: 0,${wStart},${wEnd},Default,,0,0,0,,${text}\n`;
      }
    } else {
      const text = group
        .map((g) => (def.uppercase ? g.word.toUpperCase() : g.word))
        .join(' ');
      ass += `Dialogue: 0,${formatAssTime(groupStart)},${formatAssTime(groupEnd)},Default,,0,0,0,,${text}\n`;
    }
  }

  return ass;
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function ensureBucket(supabaseUrl, supabaseKey) {
  const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      id: 'captions-output',
      name: 'captions-output',
      public: true,
    }),
  });
  // 409 = already exists — that's fine
  if (res.ok || res.status === 409) return;
  console.warn(`[captions] ensureBucket response: ${res.status}`);
}

async function uploadToSupabase(filePath, fileName, supabaseUrl, supabaseKey) {
  const fileBuffer = fs.readFileSync(filePath);
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/captions-output/${fileName}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body: fileBuffer,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase upload failed (${res.status}): ${body}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/captions-output/${fileName}`;
}

async function notifyJobComplete(jobId, supabaseKey, videoUrl) {
  const url =
    'https://kflhdlbbddjkurzxyumh.supabase.co/functions/v1/motion-studio-job-complete';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ job_id: jobId, video_url: videoUrl }),
  });
  const body = await res.text();
  console.log(`[captions] Edge Function response ${res.status}:`, body);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function extractCaptions(
  videoUrl,
  jobId,
  { style = 'heat', supabaseUrl, supabaseKey } = {},
) {
  const videoPath = path.join('/tmp', `${jobId}.mp4`);
  const audioPath = path.join('/tmp', `${jobId}.wav`);
  const assPath = path.join('/tmp', `${jobId}.ass`);
  const outputPath = path.join('/tmp', `${jobId}-captioned.mp4`);

  try {
    // 1. Download the video
    console.log(`[captions:${jobId}] Downloading video…`);
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(videoPath, buffer);
    console.log(`[captions:${jobId}] Downloaded ${buffer.length} bytes`);

    // 2. Extract audio with ffmpeg
    console.log(`[captions:${jobId}] Extracting audio…`);
    await execFileAsync('ffmpeg', [
      '-i', videoPath, '-vn', '-ar', '16000', '-ac', '1', '-y', audioPath,
    ]);
    console.log(`[captions:${jobId}] Audio extracted`);

    // 3. Transcribe with Whisper
    console.log(`[captions:${jobId}] Transcribing with Whisper…`);
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });
    const words = transcription.words || [];
    console.log(`[captions] words:`, JSON.stringify(words.slice(0, 5)));

    if (words.length === 0) {
      return { words, video_url: null };
    }

    // 4. Generate .ass subtitle file
    console.log(`[captions:${jobId}] Generating .ass (style: ${style})…`);
    const assContent = generateAss(words, style);
    fs.writeFileSync(assPath, assContent);

    // 5. Burn subtitles into video
    console.log(`[captions:${jobId}] Burning subtitles…`);
    await execFileAsync(
      'ffmpeg',
      ['-i', videoPath, '-vf', `ass=${assPath}`, '-c:a', 'copy', '-y', outputPath],
      { timeout: 120_000 },
    );
    console.log(`[captions:${jobId}] Subtitles burned`);

    // 6. Upload to Supabase Storage
    let publicUrl = null;
    if (supabaseUrl && supabaseKey) {
      console.log(`[captions:${jobId}] Uploading to Supabase…`);
      await ensureBucket(supabaseUrl, supabaseKey);
      const fileName = `${jobId}.mp4`;
      publicUrl = await uploadToSupabase(outputPath, fileName, supabaseUrl, supabaseKey);
      console.log(`[captions:${jobId}] Uploaded → ${publicUrl}`);

      // 7. Notify Edge Function
      await notifyJobComplete(jobId, supabaseKey, publicUrl);
    }

    return { words, video_url: publicUrl };
  } finally {
    for (const f of [videoPath, audioPath, assPath, outputPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}
