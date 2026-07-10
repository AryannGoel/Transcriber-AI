#!/usr/bin/env python3
"""
Cloud Audio-to-Hinglish Transcriber
Goal: Transcribe spoken Hindi/Hinglish audio into WhatsApp-style romanized Hindi using Groq and Aksharamukha.
"""

import os
import sys
import re
import argparse
import tempfile
import subprocess
import unicodedata
from pathlib import Path

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try to import groq
try:
    from groq import Groq
except ImportError:
    Groq = None

# Try to import aksharamukha
try:
    import aksharamukha.transliterate
except ImportError:
    aksharamukha = None


def check_dependencies():
    """Verify that required external libraries are available."""
    missing = []
    if Groq is None:
        missing.append("groq")
    if aksharamukha is None:
        missing.append("aksharamukha")
    
    if missing:
        print("\n[!] Missing dependencies. Please install them using:")
        print(f"    pip install {' '.join(missing)}")
        print("    (Ensure you also have python-dotenv installed if using .env files)\n")
        sys.exit(1)


def convert_and_compress_audio(input_path: Path) -> Path:
    """
    Convert any video or non-standard audio format to MP3, and downsample to
    16kHz mono MP3 if the file size is large, to guarantee compatibility with Groq's 25MB limit.
    Uses ffmpeg via subprocess.
    """
    file_size_bytes = os.path.getsize(input_path)
    is_large = file_size_bytes > 25 * 1024 * 1024
    ext = input_path.suffix.lower()
    
    if is_large:
        print(f"[*] File is large ({file_size_bytes / (1024*1024):.2f} MB).")
        print("[*] Downsampling and converting to mono 16kHz MP3 to fit within Groq's 25MB limit...")
    else:
        print(f"[*] Preprocessing input file '{input_path.name}' ({ext}) for robust API transmission...")
        print("[*] Extracting/converting audio to standard MP3 via ffmpeg...")
        
    temp_dir = Path(tempfile.gettempdir())
    output_path = temp_dir / f"{input_path.stem}_processed.mp3"
    
    # Run ffmpeg command
    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-ac", "1",          # Mono
        "-ar", "16000",      # 16kHz sample rate
    ]
    
    # Use 32k bitrate for large files, otherwise 64k for optimal quality while maintaining safety
    if is_large:
        cmd.extend(["-b:a", "32k"])
    else:
        cmd.extend(["-b:a", "64k"])
        
    cmd.append(str(output_path))
    
    try:
        # Check if ffmpeg exists
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("\n[!] Error: ffmpeg is not installed or not in system PATH.")
        print("    Ffmpeg is required to extract audio from videos and process files for Groq compatibility.")
        print("    Please install ffmpeg (Windows: winget install Gyan.FFmpeg, Mac: brew install ffmpeg).\n")
        sys.exit(1)
        
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        print(f"[+] Processed audio saved temporarily to: {output_path} ({os.path.getsize(output_path) / (1024*1024):.2f} MB)")
        return output_path
    except subprocess.CalledProcessError as e:
        print(f"\n[!] Failed to process audio/video with ffmpeg: {e}\n")
        sys.exit(1)


def clean_word_transliteration(word: str) -> str:
    """
    Clean up diacritics, strip underscores, replace trailing apostrophes/nasal markings,
    and apply specific WhatsApp-style phonetic spellings.
    """
    # 1. Normalize diacritics (macrons like ā, ū, ī, o̐, etc.) and strip combining marks
    # This transforms e.g. "kā" -> "ka", "ū" -> "u", "ī" -> "i"
    normalized = unicodedata.normalize('NFKD', word)
    cleaned = "".join([c for c in normalized if unicodedata.category(c) != 'Mn'])
    
    # 2. Specific nasal spelling replacements (hoom' -> hun, hain' -> hain, दोस्तों -> doston)
    # These replacements ensure natural WhatsApp-style typing.
    cleaned = re.sub(r'hoom\'', 'hun', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'hum\'', 'hun', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'hoon\'', 'hun', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'hoom\b', 'hun', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'hum\b', 'hun', cleaned, flags=re.IGNORECASE)
    
    cleaned = re.sub(r'hain\'', 'hain', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'hain\b', 'hain', cleaned, flags=re.IGNORECASE)
    
    cleaned = re.sub(r'doston\'', 'doston', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'doston\b', 'doston', cleaned, flags=re.IGNORECASE)
    
    # 3. Standard trailing apostrophe nasalization replacement:
    # e.g., hoom' -> hoon, hain' -> hain, or trailing apostrophe -> n
    cleaned = re.sub(r'([aeiou])m\'', r'\1n', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'([aeiou])n\'', r'\1n', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'([aeiou])\'', r'\1n', cleaned, flags=re.IGNORECASE)
    
    # 4. Remove all stray apostrophes or underscores left over by Aksharamukha
    cleaned = cleaned.replace("'", "")
    cleaned = cleaned.replace("_", "")
    
    return cleaned


def romanize_text(text: str) -> str:
    """
    Romanize only Devanagari segments (U+0900 - U+097F) in the text.
    Preserves all Latin text (English words, punctuation, spaces) exactly as returned.
    """
    if not text:
        return ""
    
    # Split text into Devanagari blocks and non-Devanagari blocks
    # Devanagari range is [\u0900-\u097F]. Capturing parenthesis includes the matches in the split list.
    segments = re.split(r'([\u0900-\u097F]+)', text)
    
    transliterated_segments = []
    for segment in segments:
        if not segment:
            continue
        
        # Check if segment is a Devanagari block
        if re.match(r'^[\u0900-\u097F]+$', segment):
            # Romanize with aksharamukha, enabling nativize and removing Hindi schwa (a)
            trans_seg = aksharamukha.transliterate.process(
                "Devanagari", "RomanReadable", segment,
                nativize=True, pre_options=["RemoveSchwaHindi"]
            )
            # Post-process the romanized segment
            trans_seg = clean_word_transliteration(trans_seg)
            transliterated_segments.append(trans_seg)
        else:
            # Keep Latin words, punctuation, spaces exactly as returned
            transliterated_segments.append(segment)
            
    return "".join(transliterated_segments)


def transcribe_audio_groq(file_path: Path, model: str, language: str = None, prompt: str = None) -> str:
    """Send audio file to Groq Whisper transcription API."""
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        print("\n[!] Error: GROQ_API_KEY environment variable is not set.")
        print("    Please set GROQ_API_KEY inside your .env file or environment.")
        print("    Get a free API key from https://console.groq.com\n")
        sys.exit(1)
        
    client = Groq(api_key=groq_key)
    
    print(f"[*] Sending audio to Groq Whisper endpoint using model: '{model}'...")
    try:
        with open(file_path, "rb") as audio_file:
            # Prepare optional parameters
            kwargs = {
                "file": (file_path.name, audio_file.read()),
                "model": model,
                "response_format": "verbose_json"
            }
            if language:
                kwargs["language"] = language
            if prompt:
                kwargs["prompt"] = prompt
                
            response = client.audio.transcriptions.create(**kwargs)
        return response.text
    except Exception as e:
        # Standardize error handling for 401 Unauthorized and 429 Rate Limits
        err_msg = str(e)
        if "401" in err_msg or "unauthorized" in err_msg.lower():
            print("\n[!] Error: Groq authentication failed (401). Please verify your GROQ_API_KEY.")
        elif "429" in err_msg or "rate limit" in err_msg.lower():
            print("\n[!] Error: Groq rate limit exceeded (429). Please wait a bit before retrying.")
        else:
            print(f"\n[!] Error communicating with Groq API: {e}")
        sys.exit(1)


def run_live_microphone(model: str, keep_devanagari: bool, language: str = None, prompt: str = None):
    """
    Live microphone recording loop. Records short audio segments,
    transcribes them using Groq, and prints romanized Hinglish in real time.
    """
    try:
        import sounddevice as sd
        import soundfile as sf
        import numpy as np
    except ImportError:
        print("\n[!] Live microphone mode requires additional packages:")
        print("    pip install sounddevice numpy soundfile")
        print("    Please install these packages and try again.\n")
        sys.exit(1)
        
    print("\n" + "="*50)
    print("         LIVE MICROPHONE TRANSCRIBER MODE")
    print("  Press Ctrl+C to stop recording and exit.")
    print("="*50 + "\n")
    
    # Get active API key
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        print("[!] Error: GROQ_API_KEY environment variable is not set.\n")
        sys.exit(1)
        
    sample_rate = 16000
    channels = 1
    chunk_seconds = 5  # record in 5-second intervals
    
    print(f"[*] Listening... (recording in {chunk_seconds}s increments. Talk now!)")
    
    try:
        while True:
            # Record a chunk
            recording = sd.rec(
                int(chunk_seconds * sample_rate),
                samplerate=sample_rate,
                channels=channels,
                dtype='float32'
            )
            sd.wait()  # Wait until the recording is finished
            
            # Save chunk to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_path = Path(temp_file.name)
                sf.write(temp_path, recording, sample_rate)
            
            try:
                # Transcribe chunk
                raw_text = transcribe_audio_groq(temp_path, model, language=language, prompt=prompt)
                
                # Filter out blank or very silent transcriptions
                if raw_text.strip() and not re.match(r'^(Subtitles|Thank you|you|bye)\.?$', raw_text.strip(), re.I):
                    if keep_devanagari:
                        print(f"\nHindi: {raw_text}")
                    else:
                        romanized = romanize_text(raw_text)
                        print(f"\nHinglish: {romanized}")
            except Exception as e:
                print(f"\n[!] Error in live chunk processing: {e}")
            finally:
                # Delete temporary chunk file
                if temp_path.exists():
                    os.unlink(temp_path)
                    
    except KeyboardInterrupt:
        print("\n\n[*] Stopped live microphone transcription. Goodbye!")
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(
        description="Cloud Audio-to-Hinglish Transcriber (Groq API)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "audio_file",
        nargs="?",
        help="Path to the audio file to transcribe (wav, mp3, m4a, mp4)"
    )
    parser.add_argument(
        "--model",
        default="whisper-large-v3",
        choices=["whisper-large-v3", "whisper-large-v3-turbo"],
        help="Groq Whisper model to use"
    )
    parser.add_argument(
        "--keep-devanagari",
        action="store_true",
        help="Skip romanization and output raw Devanagari Hindi text"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Launch interactive live microphone transcription mode"
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Specify transcription language code (e.g. 'hi', 'en'). Leave empty to auto-detect."
    )
    parser.add_argument(
        "--prompt",
        default=None,
        help="Provide a transcription prompt to guide Whisper (e.g. vocabulary or formatting)."
    )
    
    args = parser.parse_args()
    
    # 1. Verify dependencies are installed
    check_dependencies()
    
    # 2. Check flags and start correct mode
    if args.live:
        run_live_microphone(args.model, args.keep_devanagari, language=args.language, prompt=args.prompt)
        return
        
    if not args.audio_file:
        parser.print_help()
        print("\n[!] Please specify an audio file path OR use --live for mic mode.\n")
        sys.exit(1)
        
    audio_path = Path(args.audio_file)
    if not audio_path.exists():
        print(f"\n[!] Error: File not found: {audio_path}\n")
        sys.exit(1)
        
    # Check if we need to preprocess (either unsupported extension, video format, or size > 25MB)
    file_size_bytes = os.path.getsize(audio_path)
    limit_bytes = 25 * 1024 * 1024
    
    supported_extensions = {'.mp3', '.wav', '.m4a', '.webm', '.mpga', '.mpeg'}
    file_ext = audio_path.suffix.lower()
    
    # Needs conversion if extension not directly accepted by Groq, OR if file is larger than 25MB
    needs_conversion = (file_ext not in supported_extensions) or (file_size_bytes > limit_bytes)
    
    active_audio_path = audio_path
    is_temp = False
    
    if needs_conversion:
        active_audio_path = convert_and_compress_audio(audio_path)
        is_temp = True
        
    try:
        # Transcribe
        raw_hindi = transcribe_audio_groq(
            active_audio_path, 
            args.model, 
            language=args.language, 
            prompt=args.prompt
        )
        
        print("\n--- RAW TRANSCRIPTION (Devanagari) ---")
        print(raw_hindi)
        
        # Romanize if requested
        if args.keep_devanagari:
            final_output = raw_hindi
        else:
            print("\n[*] Local Romanization in progress (Devanagari -> Hinglish)...")
            final_output = romanize_text(raw_hindi)
            print("\n--- ROMANIZED HINGLISH TRANSCRIPT ---")
            print(final_output)
            
        # Save output to file next to original audio
        txt_output_path = audio_path.with_suffix(".txt")
        with open(txt_output_path, "w", encoding="utf-8") as out_file:
            out_file.write(final_output)
            
        print(f"\n[+] Success! Transcript saved to: {txt_output_path}\n")
        
    finally:
        # Cleanup temporary compressed files
        if is_temp and active_audio_path.exists():
            os.unlink(active_audio_path)


if __name__ == "__main__":
    main()
