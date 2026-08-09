---
"@nodaro/sdk": minor
---

`client.pickerCatalogs.analyzeText({ text, targetPickers?, ... })` — the new
`POST /v1/text-to-picker` endpoint: fill picker selections from a free-text
scene description (same `pickerJson` + `gaps` shape as describe-to-picker;
omit `targetPickers` to analyze against every catalog).
