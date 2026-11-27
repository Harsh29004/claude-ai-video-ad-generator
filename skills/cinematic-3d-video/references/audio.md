# Audio: voiceover, score and sound effects

## Voiceover
Write one short line per shot, in the language the audience speaks. Keep it to about 2.5 words per second. Put the files in `<engine>/public/<slug>/vo-N.mp3` and attach each one to its shot:
```json
"voiceover": {"src": "<slug>/vo-1.mp3", "delayInFrames": 8, "volume": 1}
```
The composition measures each file and lengthens the shot if the line would be cut off. Music is ducked under it automatically (`duckMusic`).

Ways to make the voice files, best first:
1. **The user's own recording.** Use it as is, split per line, or trim it with ffmpeg (`-ss` and `-to`).
2. **ElevenLabs** (if `ELEVENLABS_API_KEY` is set): POST to `https://api.elevenlabs.io/v1/text-to-speech/<voice_id>` with `{"text": "...", "model_id": "eleven_multilingual_v2"}` and save the MP3.
3. **edge-tts** (free neural voices, needs internet; the text goes to Microsoft's speech service): run `pip install edge-tts`, then
   `edge-tts --voice en-US-AriaNeural --text "..." --write-media public/<slug>/vo-1.mp3`.
   Voices include `en-US-AriaNeural`, `en-US-GuyNeural`, `en-GB-SoniaNeural`, `en-IN-NeerjaNeural`, `hi-IN-SwaraNeural`, `hi-IN-MadhurNeural`, `es-ES-ElviraNeural`, `fr-FR-DeniseNeural`, `de-DE-KatjaNeural`, `ar-SA-ZariyahNeural` and `ja-JP-NanamiNeural`. Run `edge-tts --list-voices` for the full list. For Hinglish, write the line in Devanagari for a Hindi voice, and show Roman Hinglish in `caption`.
4. **Offline OS voices** (robotic; use only when nothing else is available):
   - Windows: `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('vo-1.wav'); $s.Speak('...'); $s.Dispose()`
   - macOS: `say -o vo-1.aiff "..."`
   - Linux: `espeak-ng -w vo-1.wav "..."`

When the voice is synthetic, tell the user, and label it where the platform requires.

## Score and SFX: `npm run soundtrack`
```bash
npm run soundtrack -- --props projects/<slug>.json --write [--style ambient|epic|tech|warm] [--mp3] [--seed 2] [--dir public/assets]
```
- Reads the storyboard, including measured voiceover lengths and transition timings. Writes `<name>-music` and `<name>-sfx`.
- **Music:** chord pads, sub-bass, plucked arpeggios and drums (by style), with reverb, faded in and out. It is mastered quieter under narration and louder without it.
- **SFX:** a whoosh at every cut (centred on the transition, panned across), a riser and impact into the final shot, and a soft hit on the first frame.
- `--write` adds both to `audio` (`role: music` is ducked; `role: sfx` is not) and replaces any older copies.
- Auto style: `city` or `abstract` → tech, `terrain` → epic, `space` → ambient, otherwise warm. A different `--seed` gives the same style with a different random texture.
- Everything is synthesised locally, so there is no licensing question.

If the user gives you music, add `{"src": "assets/track.mp3", "role": "music", "volume": 0.8, "loop": true}`. You can still generate SFX alone, by running the script and deleting its music entry.

## Mix targets
- Final loudness about −14 LUFS for social, and −16 to −18 for YouTube or web. `npm run check` reports it.
- Narration should sit clearly above the music. If the music fights the voice, lower the music `volume` or set `duckMusic` to 0.2.
- If the SFX feel loud, set the sfx `volume` to 0.4–0.6.
