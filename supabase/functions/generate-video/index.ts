import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// Video Generation Edge Function
//
// Three modes:
// 1. "image_to_video"  - Ken Burns effect on a single image + text overlay
// 2. "carousel_video"  - Multiple images stitched with transitions
// 3. "voiceover"       - Adds TTS voiceover to any of the above
//
// IMPORTANT: This edge function generates an FFmpeg command spec
// that must be executed on your Railway backend (Deno edge functions
// don't have FFmpeg). The Railway backend should have an endpoint
// that accepts this spec and returns the video URL.
//
// If you don't have the Railway backend video processor yet,
// this function returns the spec as JSON so the video generation
// is "ready to plug in" once the backend is set up.
// ============================================================

// Aspect ratio presets (width x height in pixels)
const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },   // Reels, TikTok, Stories
  "1:1": { width: 1080, height: 1080 },    // Instagram feed
  "4:5": { width: 1080, height: 1350 },    // Instagram portrait
  "16:9": { width: 1920, height: 1080 },   // YouTube, LinkedIn, Facebook
  "1.91:1": { width: 1200, height: 628 },  // LinkedIn article
};

function buildKenBurnsCommand(
  imageUrl: string,
  outputPath: string,
  duration: number,
  aspectRatio: string,
  hookText: string | null,
  captionText: string | null,
): string[] {
  const dims = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS["9:16"];
  const { width, height } = dims;

  // Ken Burns: slow zoom from 1.0x to 1.15x over duration
  const zoomFilter = `zoompan=z='min(zoom+0.0005,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * 30}:s=${width}x${height}:fps=30`;

  const filters: string[] = [zoomFilter];

  // Add hook text overlay at the top (first 3 seconds)
  if (hookText) {
    const escapedHook = hookText.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    filters.push(
      `drawtext=text='${escapedHook}':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,3)'`
    );
  }

  // Add caption text at the bottom (after hook fades, stays until end)
  if (captionText) {
    // Truncate to ~80 chars for on-screen readability
    const shortCaption = captionText.length > 80
      ? captionText.slice(0, 77) + "..."
      : captionText;
    const escapedCaption = shortCaption.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    filters.push(
      `drawtext=text='${escapedCaption}':fontsize=36:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h*0.82:enable='gte(t,2)'`
    );
  }

  return [
    "ffmpeg",
    "-loop", "1",
    "-i", imageUrl,
    "-vf", filters.join(","),
    "-t", String(duration),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ];
}

function buildCarouselCommand(
  imageUrls: string[],
  outputPath: string,
  durationPerSlide: number,
  transitionDuration: number,
  aspectRatio: string,
  hookText: string | null,
): string[] {
  const dims = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS["9:16"];
  const { width, height } = dims;

  // Build input args
  const inputArgs: string[] = [];
  imageUrls.forEach((url) => {
    inputArgs.push("-loop", "1", "-t", String(durationPerSlide), "-i", url);
  });

  // Build filter complex for crossfade transitions
  const filterParts: string[] = [];
  const n = imageUrls.length;

  // Scale each input
  for (let i = 0; i < n; i++) {
    filterParts.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
    );
  }

  // Chain crossfades
  if (n === 1) {
    filterParts.push(`[v0]null[outv]`);
  } else {
    let prev = "v0";
    for (let i = 1; i < n; i++) {
      const offset = i * durationPerSlide - (i * transitionDuration);
      const out = i === n - 1 ? "outv" : `cf${i}`;
      filterParts.push(
        `[${prev}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}[${out}]`
      );
      prev = out;
    }
  }

  // Add hook text
  if (hookText) {
    const escapedHook = hookText.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    filterParts.push(
      `[outv]drawtext=text='${escapedHook}':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,3)'[final]`
    );
  } else {
    filterParts.push(`[outv]null[final]`);
  }

  return [
    "ffmpeg",
    ...inputArgs,
    "-filter_complex", filterParts.join(";"),
    "-map", "[final]",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ];
}

function buildTTSCommand(
  text: string,
  outputAudioPath: string,
  voice: string = "en-US-JennyNeural",
): { engine: string; text: string; voice: string; outputPath: string } {
  // Edge TTS command spec (to be run via edge-tts Python package on Railway)
  // Command: edge-tts --voice "en-US-JennyNeural" --text "..." --write-media output.mp3
  return {
    engine: "edge-tts",
    text: text.slice(0, 500), // Keep TTS under ~45 seconds
    voice,
    outputPath: outputAudioPath,
  };
}

function buildMergeAudioVideoCommand(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): string[] {
  return [
    "ffmpeg",
    "-i", videoPath,
    "-i", audioPath,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      requestId,
      mode,           // "image_to_video" | "carousel_video" | "voiceover"
      imageUrls,      // Array of image URLs (1 for single, multiple for carousel)
      aspectRatio,    // "9:16", "1:1", "4:5", "16:9"
      hookText,       // On-screen text hook (first 3 seconds)
      captionText,    // Bottom caption text
      voiceoverText,  // Text for TTS narration
      voice,          // TTS voice (default: en-US-JennyNeural)
      duration,       // Duration in seconds (default: 15)
      platform,       // Target platform (determines defaults)
    } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const RAILWAY_VIDEO_URL = Deno.env.get("RAILWAY_VIDEO_PROCESSOR_URL");

    // Set platform-aware defaults
    const finalAspectRatio = aspectRatio || (
      platform === "tiktok" || platform === "instagram" ? "9:16" :
      platform === "linkedin" ? "1.91:1" : "16:9"
    );
    const finalDuration = duration || (platform === "tiktok" ? 15 : 20);

    // Build the video generation spec
    const outputFileName = `${requestId}/${Date.now()}_video.mp4`;
    const tempVideoPath = `/tmp/${Date.now()}_video.mp4`;
    const tempAudioPath = `/tmp/${Date.now()}_audio.mp3`;
    const finalOutputPath = `/tmp/${Date.now()}_final.mp4`;

    let videoSpec: any;

    if (mode === "carousel_video" && imageUrls && imageUrls.length > 1) {
      videoSpec = {
        type: "carousel",
        ffmpegCommand: buildCarouselCommand(
          imageUrls,
          tempVideoPath,
          finalDuration / imageUrls.length, // Duration per slide
          0.5, // Transition duration
          finalAspectRatio,
          hookText
        ),
      };
    } else {
      videoSpec = {
        type: "ken_burns",
        ffmpegCommand: buildKenBurnsCommand(
          imageUrls?.[0] || "",
          tempVideoPath,
          finalDuration,
          finalAspectRatio,
          hookText,
          captionText
        ),
      };
    }

    // Add TTS spec if voiceover requested
    let ttsSpec = null;
    let mergeSpec = null;

    if (mode === "voiceover" || voiceoverText) {
      ttsSpec = buildTTSCommand(
        voiceoverText || captionText || hookText || "",
        tempAudioPath,
        voice || "en-US-JennyNeural"
      );
      mergeSpec = {
        ffmpegCommand: buildMergeAudioVideoCommand(
          tempVideoPath,
          tempAudioPath,
          finalOutputPath
        ),
      };
    }

    const fullSpec = {
      requestId,
      video: videoSpec,
      tts: ttsSpec,
      merge: mergeSpec,
      output: {
        fileName: outputFileName,
        storageBucket: "generated-content",
        aspectRatio: finalAspectRatio,
        estimatedDuration: finalDuration,
      },
    };

    // Try to send to Railway video processor if configured
    if (RAILWAY_VIDEO_URL) {
      try {
        const processorRes = await fetch(`${RAILWAY_VIDEO_URL}/process-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fullSpec),
        });

        if (processorRes.ok) {
          const result = await processorRes.json();

          if (result.videoUrl) {
            // Store the video URL
            await supabase.from("audit_log").insert({
              request_id: requestId,
              action: "video_generated",
              details: {
                mode,
                platform,
                aspectRatio: finalAspectRatio,
                duration: finalDuration,
                videoUrl: result.videoUrl,
                hasVoiceover: !!ttsSpec,
              },
            });

            return new Response(
              JSON.stringify({
                success: true,
                videoUrl: result.videoUrl,
                spec: fullSpec,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        console.error("Railway video processor not available:", e);
      }
    }

    // Railway not configured or failed - return the spec for manual processing
    // or future connection
    await supabase.from("audit_log").insert({
      request_id: requestId,
      action: "video_spec_generated",
      details: {
        mode,
        platform,
        aspectRatio: finalAspectRatio,
        duration: finalDuration,
        hasVoiceover: !!ttsSpec,
        note: RAILWAY_VIDEO_URL
          ? "Railway processor returned error, spec saved for retry"
          : "Railway video processor not configured yet. Spec saved.",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: null,
        spec: fullSpec,
        message: "Video spec generated. Connect the Railway video processor to render videos automatically.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
