# Upload Video

> Upload or provide a URL to a video file.

## Overview

The Upload Video node provides a source video to the workflow. Enter a direct URL or upload a video file to make it available for downstream processing, effects, or transformation nodes.

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| URL | Text input | — | Direct URL to a video file |

Accepts: MP4, MOV, WebM formats.

## Adjust Video

Choosing a file opens an **Adjust Video** step before the upload is committed: crop with an aspect-ratio preset, trim to a range using the filmstrip scrubber, and optionally convert to MP4 or WebM (under **Advanced**). Formats the browser cannot play are converted automatically first.

## Inputs & Outputs

**Inputs:** None (this is a source node)

**Outputs:**
- Video URL — accessible to downstream nodes
## Best Practices

- Use standard formats (MP4 with H.264) for maximum compatibility
- Keep source videos under 100MB for reliable processing

## Common Use Cases

- Source video for Video to Video transformation
- Input for video processing (trim, resize, combine, captions)
- Reference motion video for Motion Transfer
- Source for After Effects or composition nodes

## Tips

- For YouTube or social media videos, use the Video URL node instead — it handles platform-specific downloads
- Connect to Trim Video first if you only need a specific section
