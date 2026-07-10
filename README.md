# Cloud Audio-to-Hinglish Transcriber (Groq API)

A local, high-performance command-line application that transcribes spoken Hindi/Hinglish audio files into casual, WhatsApp-style romanized Hindi (Hinglish) — Hindi written in Latin characters. 

The speech-to-text recognition runs on the **Groq Cloud API** using the state-of-the-art **Whisper Large V3** model (fast and accurate), while the transliteration and schwa-deletion process runs completely **locally** to preserve privacy and keep execution fast.

---

## 🚀 Key Features

*   **Transliterate, Never Translate**: Keep Hindi words exactly as Hindi; only change Devanagari script to Latin characters (e.g., `आपका क्या नाम है` becomes `aapka kya naam hai`).
*   **English Word Preservation**: Only transliterates Devanagari Unicode (`U+0900` to `U+097F`). English/Latin words (like `workout`, `office`, `lunch`, `meeting`) are preserved exactly as Whisper transcribed them without phonetic re-spelling.
*   **WhatsApp Spelling Standards**: Applies customized schwa-deletion and nasal-ending mapping rules:
    *   पसंद → `pasand` | कल → `kal` | हम → `ham` (Hindi schwa-deletion)
    *   हूँ → `hun` | हैं → `hain` | दोस्तों → `doston` (nasal endings -> `n`)
*   **Large Audio File Handling**: Automatically downsamples and compresses files larger than 25MB to mono 16kHz MP3s using `ffmpeg` to fit within Groq's free-tier payload limits.
*   **CLI Versatility**: Includes support for different Whisper models (`--model`), raw Hindi script retention (`--keep-devanagari`), and interactive live microphone transcription (`--live`).
*   **Autosave**: Prints the Hinglish transcript to the console and automatically saves a `.txt` file with the transcript right next to your input audio file.

---

## 🛠️ Windows Setup & Installation

### Step 1: Install Python
If you don't have Python installed:
1. Download Python 3.10+ from the [official website](https://www.python.org/downloads/).
2. **CRITICAL**: Check the box that says **"Add Python to PATH"** during installation.

### Step 2: Set Up FFmpeg (Highly Recommended)
FFmpeg is used for automatic audio file downsampling and live microphone recordings.
*   **easiest way (Windows Terminal / PowerShell)**:
    ```powershell
    winget install Gyan.FFmpeg
    ```
    *Alternatively, restart your Terminal/Command Prompt after running this command to refresh your system PATH.*

### Step 3: Install Dependencies
Open your Command Prompt or PowerShell in this directory and run:
```cmd
pip install -r requirements.txt
```

### Step 4: Configure your Groq API Key
1. Go to the [Groq Console](https://console.groq.com) and sign up for a free account.
2. Generate an API Key under the **API Keys** tab.
3. Create a `.env` file in the same directory as the script, and paste your key:
```env
GROQ_API_KEY=gsk_your_actual_key_here
```

---

## 💻 Usage & CLI Flags

### 1. Basic Audio File Transcription (Standard)
Transcribes and romanizes an audio file, printing the Hinglish transcript and saving it to `audio_clip.txt`.
```bash
python transcriber.py path/to/audio_clip.wav
```
*(Supports `wav`, `mp3`, `m4a`, `mp4`)*

### 2. Keep Raw Hindi (Skip Romanization)
Use `--keep-devanagari` to output the exact transcription in Devanagari script:
```bash
python transcriber.py path/to/audio_clip.wav --keep-devanagari
```

### 3. Change Transcription Model
Switch between models (`whisper-large-v3` vs lower-latency `whisper-large-v3-turbo`):
```bash
python transcriber.py path/to/audio_clip.wav --model whisper-large-v3-turbo
```

### 4. Interactive Live Microphone Mode
Speak in short increments and get Hinglish printed in real time:
```bash
python transcriber.py --live
```
*(Requires `pip install sounddevice numpy soundfile`)*

---

## 🧪 Acceptance Test Examples

| Input Speech Audio | Raw Hindi (Devanagari) | Romanized Hinglish (Output) |
| :--- | :--- | :--- |
| "आपका क्या नाम है" | आपका क्या नाम है | `aapka kya naam hai` |
| "मैं कुछ समय से वर्कआउट कर रहा हूँ।" | मैं कुछ समय से वर्कआउट कर रहा हूँ। | `main kuch samay se workout kar raha hun` |
| "कल दोस्तों के साथ लंच करेंगे।" | कल दोस्तों के साथ लंच करेंगे। | `kal doston ke sath lunch karenge` |
