/**
 * Nodaro Cloud video provider (community cloud-connect, Phase 4a).
 *
 * Implements ImageToVideoProvider + TextToVideoProvider by POSTing to the
 * connected cloud's own public generation routes —
 *   image-to-video → POST /v1/generate-video   (generateVideoBody)
 *   text-to-video  → POST /v1/text-to-video    (textToVideoBody)
 * — then polling GET /v1/jobs/:id until completion. The connected cloud
 * account's wallet is billed; the instance sees no USD cost (`cost: null`).
 */

import type {
  ImageToVideoProvider,
  TextToVideoProvider,
  ProviderOptions,
  ProviderResult,
  ReconcileOpts,
} from "../provider.interface.js"
import { createCloudJob, waitForCloudJob, NodaroCloudError } from "./client.js"

/**
 * Invert the worker's ProviderOptions.klingElements (KIE wire shape with
 * element_input_urls / element_input_video_urls) back into the route's
 * `elements` shape ({ name, description, type, urls }) — the exact inverse of
 * the mapping workers/handlers/video-ai.ts applies on the way in.
 */
function toRouteElements(
  klingElements: NonNullable<ProviderOptions["klingElements"]>,
): Array<{ name: string; description: string; type: "image" | "video"; urls: string[] }> {
  return klingElements.map((el) => {
    const videoUrls = el.element_input_video_urls ?? []
    const imageUrls = el.element_input_urls ?? []
    return videoUrls.length > 0
      ? { name: el.name, description: el.description, type: "video" as const, urls: videoUrls }
      : { name: el.name, description: el.description, type: "image" as const, urls: imageUrls }
  })
}

/**
 * ProviderOptions → cloud route body fields shared by both video routes.
 * Boolean/number levers use `!== undefined` guards so meaningful falsy values
 * (e.g. `sound: false`, `seed: 0`) still reach the cloud.
 */
function sharedVideoBody(options?: ProviderOptions): Record<string, unknown> {
  if (!options) return {}
  return {
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
    ...(options.sound !== undefined ? { sound: options.sound } : {}),
    ...(options.negativePrompt !== undefined ? { negativePrompt: options.negativePrompt } : {}),
    ...(options.cfgScale !== undefined ? { cfgScale: options.cfgScale } : {}),
    ...(options.multiShots !== undefined ? { multiShot: options.multiShots } : {}),
    ...(options.multiPrompt?.length ? { shots: options.multiPrompt } : {}),
    ...(options.klingElements?.length ? { elements: toRouteElements(options.klingElements) } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
    ...(options.resolution !== undefined ? { resolution: options.resolution } : {}),
    ...(options.generateAudio !== undefined ? { generateAudio: options.generateAudio } : {}),
    ...(options.referenceImageUrls?.length ? { referenceImageUrls: options.referenceImageUrls } : {}),
    ...(options.referenceVideoUrls?.length ? { referenceVideoUrls: options.referenceVideoUrls } : {}),
    ...(options.referenceAudioUrls?.length ? { referenceAudioUrls: options.referenceAudioUrls } : {}),
    ...(options.webSearch !== undefined ? { webSearch: options.webSearch } : {}),
    ...(options.nsfwChecker !== undefined ? { nsfwChecker: options.nsfwChecker } : {}),
    ...(options.enableTranslation !== undefined ? { enableTranslation: options.enableTranslation } : {}),
  }
}

/** Extra fields only the image-to-video route (generateVideoBody) accepts. */
function i2vOnlyBody(options?: ProviderOptions): Record<string, unknown> {
  if (!options) return {}
  return {
    ...(options.aspectRatio !== undefined ? { aspectRatio: options.aspectRatio } : {}),
    ...(options.motionPrompt !== undefined ? { motionPrompt: options.motionPrompt } : {}),
    ...(options.grokMode !== undefined ? { grokMode: options.grokMode } : {}),
    ...(options.cameraFixed !== undefined ? { cameraFixed: options.cameraFixed } : {}),
    ...(options.generationType !== undefined ? { generationType: options.generationType } : {}),
    ...(options.videoTrimStart !== undefined ? { videoTrimStart: options.videoTrimStart } : {}),
    ...(options.videoTrimEnd !== undefined ? { videoTrimEnd: options.videoTrimEnd } : {}),
  }
}

/** Read the finalized video URL out of a completed cloud job. */
function extractVideoResult(
  job: { output_data?: Record<string, unknown> | null },
  jobId: string,
): ProviderResult {
  const output = (job.output_data ?? {}) as { videoUrl?: unknown }
  const url = typeof output.videoUrl === "string" ? output.videoUrl : undefined
  if (!url) {
    throw new NodaroCloudError(
      `Nodaro Cloud: video job ${jobId} completed but returned no videoUrl`,
    )
  }
  // The cloud's thumbnailUrl is ignored — the instance worker regenerates its
  // own thumbnail from the downloaded clip during finalize.
  return { url, cost: null }
}

export class NodaroCloudVideoProvider
  implements ImageToVideoProvider, TextToVideoProvider
{
  // NOTE: reconcileOpts.onTaskCreated is deliberately NOT called in either
  // method — see the rationale in ./image.ts (provider_kind is model-keyed;
  // persisting the cloud job id would mislabel it as a KIE task and the
  // reconcile cron would force-fail a job still running on the cloud).

  async imageToVideo(
    imageUrl: string | undefined,
    prompt?: string,
    model?: string,
    duration?: number,
    endFrameUrl?: string,
    options?: ProviderOptions,
    _reconcileOpts?: ReconcileOpts,
  ): Promise<ProviderResult> {
    const body: Record<string, unknown> = {
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(prompt !== undefined ? { prompt } : {}),
      ...(model !== undefined ? { provider: model } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(endFrameUrl !== undefined ? { endFrameUrl } : {}),
      ...sharedVideoBody(options),
      ...i2vOnlyBody(options),
    }

    const jobId = await createCloudJob("/v1/generate-video", body)
    const job = await waitForCloudJob(jobId, options?.onProgress)
    return extractVideoResult(job, jobId)
  }

  async textToVideo(
    prompt: string,
    model?: string,
    duration?: number,
    aspectRatio?: string,
    options?: ProviderOptions,
    _reconcileOpts?: ReconcileOpts,
  ): Promise<ProviderResult> {
    const body: Record<string, unknown> = {
      prompt,
      ...(model !== undefined ? { provider: model } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(aspectRatio !== undefined ? { aspectRatio } : {}),
      ...sharedVideoBody(options),
    }

    const jobId = await createCloudJob("/v1/text-to-video", body)
    const job = await waitForCloudJob(jobId, options?.onProgress)
    return extractVideoResult(job, jobId)
  }
}
