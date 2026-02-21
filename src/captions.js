import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';

const execFileAsync = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Download video from URL, extract audio, transcribe with Whisper.
 * Returns an array of { word, start, end } objects.
 */
export async function extractCaptions(videoUrl, jobId) {
  const videoPath = path.join('/tmp', `${jobId}.mp4`);
  const audioPath = path.join('/tmp', `${jobId}.wav`);

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
      '-i', videoPath,
      '-vn', '-ar', '16000', '-ac', '1',
      '-y', audioPath,
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

    return words;
  } finally {
    // Clean up temp files
    for (const f of [videoPath, audioPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}
