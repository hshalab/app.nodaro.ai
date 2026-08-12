---
"@nodaro/shared": patch
---

Complete the `flux-fill` rollout: the provider is now actually listed in `IMAGE_I2I_PROVIDERS` (the paint-mask release declared it but the enum entry was missing, so route validation rejected the model and frontend type-check failed).
