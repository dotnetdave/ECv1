# LLM Interop Notes (EC v1)

**Goal:** Reliable copy/paste across ChatGPT, Claude, Grok, and similar chat UIs.

## Known Behaviors (manual spot checks)
- ChatGPT: accepts `t=none;ct=json`; `gz>b64` sometimes works for small payloads but may be reformatted.
- Claude: reliable with `t=none;ct=json`; often rejects or garbles compressed/base64 payloads.
- Grok: treat like Claude—use `t=none;ct=json`; avoid compressed blobs.

## Recommendations
- Default to `t=none;ct=json` for any human-facing chat UI.
- Only use `gz>b64` when both sides run an agent/tool decoder and not the chat UI.
- Keep payloads small for chat copy/paste; prefer compact JSON.
- If parsing fails, return a clear message rather than attempting to guess the format.

## Quick Test Steps
1) Paste the “tiny none” example into the target chat and request it be echoed back verbatim.
2) If you must test `gz>b64`, use a very small payload and instruct the model explicitly: “Do not rewrap; leave lines intact.”
3) Use `tools/validator.html` or `tools/ecv1-validate.js` to verify round-trip integrity.
