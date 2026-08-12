-- Migration: seed model_pricing for FLUX Fill Pro (masked inpainting via Replicate)
--
-- flux-fill runs through Replicate (black-forest-labs/flux-fill-pro) in the
-- image-to-image / modify-image lane and is the second mask-capable i2i
-- provider alongside ideogram-edit. STATIC_CREDIT_COSTS in
-- backend/src/ee/billing/credits.ts is the runtime fallback; the admin UI
-- reads pricing exclusively from this table.

INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES
  ('flux-fill', 30, true, 'image-to-image')
ON CONFLICT (model_identifier) DO NOTHING;
