# Voice Companion

Voice-first thinking partner. Static PWA shell hosted on GitHub Pages; talks to a Tailscale-only Flask backend on the Mac for live model inference, journal saves, and training pair management.

**Live:** `https://bmhsolutions3711.github.io/companion/`

## Three modes

- **🧠 Companion** — voice chat with one of three local models (Llama, Nemotron, Qwen). Has Bryan's Owner's Manual baked in.
- **💨 Brain Dump** — looser, less-coached conversation pattern.
- **🎤 Dictate** — record voice, transcribed live on screen, saved as a journal markdown file. **No model response.** Tap mic to start, tap again to save.

## Architecture

```
phone (PWA)  ──HTTPS──▶  https://bmhsolutions3711.github.io/companion/
   │                          (static shell, installable)
   │
   └──fetch w/ Bearer token──▶  https://<mac>:8430/api/{models|chat|dictate|...}
                                 (Tailscale-only — requires Tailscale connected)
```

## Phone install

1. Open Chrome/Brave on the phone, navigate to https://bmhsolutions3711.github.io/companion/
2. Browser offers Install / Add to Home screen → confirm
3. Launch from home-screen icon → setup screen prompts for backend URL + token
4. Paste the token (from your Mac's `~/.config/bmh/.env` `COMPANION_TOKEN`)
5. Tap Connect; if good, models load. Token cached for future launches.
6. Grant microphone permission when first tapping the mic icon.

## Backend

Lives at `~/Local Models/bik/companion/` in the local-only BIK repo (not on GitHub). Requires:

- `OLLAMA_URL` (defaults to `http://localhost:11434`)
- `ELEVENLABS_API_KEY` (optional — falls back to browser TTS)
- `COMPANION_TOKEN` (32-byte hex secret — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`)

Started by `bmh_start.command`.

## Cache discipline

When shipping shell changes, bump:
- `?v=N` on script tags / link tags in index.html
- `CACHE_NAME=comp-shell-vN` in sw.js
- Versioned URLs in `SHELL` array of sw.js
