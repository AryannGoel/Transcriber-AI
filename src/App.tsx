import React, { useState, useRef, useEffect } from "react";
import { 
  AudioLines, 
  UploadCloud, 
  FileAudio, 
  FileVideo,
  Check, 
  Copy, 
  Download, 
  Sparkles, 
  Terminal, 
  AlertCircle, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RefreshCw,
  HelpCircle,
  FileText,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TranscriptionResult, TranscriberOptions } from "./types";

export default function App() {
  // Key state
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [options, setOptions] = useState<TranscriberOptions>({
    model: "whisper-large-v3",
    keepDevanagari: false,
    languageMode: "hinglish",
    customPrompt: ""
  });
  const [customKey, setCustomKey] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Audio playback state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Mic recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Copy success feedback state
  const [copiedHindi, setCopiedHindi] = useState<boolean>(false);
  const [copiedHinglish, setCopiedHinglish] = useState<boolean>(false);

  // Auto clean audio ref on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  // Format recording timer
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start Mic Recording
  const startRecording = async () => {
    try {
      setError(null);
      setResult(null);
      setFile(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const recordedFile = new File([audioBlob], "recorded_audio.wav", { type: "audio/wav" });
        setFile(recordedFile);
        
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access denied:", err);
      setError("Microphone permission denied. Please allow microphone access or upload an audio file manually.");
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);
      
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      // Accept any audio or video files, plus common container extensions in case MIME types are omitted by the OS/browser
      const isValid = droppedFile.type.startsWith("audio/") || 
                      droppedFile.type.startsWith("video/") || 
                      /\.(mp3|wav|m4a|aac|ogg|flac|wma|webm|mp4|mkv|avi|mov|flv|wmv|3gp|m4v)$/i.test(droppedFile.name);
                      
      if (isValid) {
        setFile(droppedFile);
        setError(null);
        setResult(null);
        
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(droppedFile));
      } else {
        setError("Unsupported file format. Please upload an audio or video file.");
      }
    }
  };

  // Toggle Playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Trigger server-side transcription
  const handleTranscribe = async () => {
    if (!file) return;
    setIsTranscribing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", options.model);
    formData.append("keepDevanagari", options.keepDevanagari ? "true" : "false");
    formData.append("languageMode", options.languageMode);
    if (options.customPrompt) {
      formData.append("customPrompt", options.customPrompt);
    }
    
    if (customKey.trim()) {
      formData.append("groqApiKey", customKey.trim());
    }

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || "Transcription failed.");
      }

      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during transcription. Make sure your GROQ_API_KEY is configured.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Copy to clipboard
  const copyText = (text: string, type: "hindi" | "hinglish") => {
    navigator.clipboard.writeText(text);
    if (type === "hindi") {
      setCopiedHindi(true);
      setTimeout(() => setCopiedHindi(false), 2000);
    } else {
      setCopiedHinglish(true);
      setTimeout(() => setCopiedHinglish(false), 2000);
    }
  };

  // Download Transcript File
  const downloadTranscript = () => {
    if (!result) return;
    const content = result.hinglish;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file?.name.split(".")[0] || "transcript"}_romanized.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* Decorative Background Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <header className="mb-12 border-b border-slate-900 pb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-tr from-teal-500/20 to-indigo-500/20 rounded-xl border border-teal-500/30">
                <AudioLines className="w-6 h-6 text-teal-400" />
              </div>
              <span className="text-xs font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                Whisper Cloud Romanizer
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Cloud Audio-to-Hinglish Transcriber
            </h1>
            <p className="mt-2 text-slate-400 max-w-2xl text-sm leading-relaxed">
              Record or upload spoken Hindi speech and transcribe it directly into romanized, WhatsApp-style Hinglish using Groq Whisper. Real-time local schwa-deletion ensures native spelling accuracy.
            </p>
          </div>

          {/* Quick CLI download block */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a 
              href="/api/download-cli"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-sm font-medium transition duration-200 shadow-sm"
              title="Download standalone local CLI Python package"
            >
              <Terminal className="w-4 h-4 text-teal-400" />
              Download Local CLI (.zip)
            </a>
          </div>
        </header>

        {/* Dynamic Warning Alert: Missing API Key */}
        <div className="mb-8 p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-amber-400">Prerequisite Configured Server Key:</span> The transcriber uses the <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-amber-200 font-mono">GROQ_API_KEY</code> set in your environment. You can configure this key via the Secrets/Settings menu in the AI Studio UI, or supply an override key in the options panel below.
          </div>
        </div>

        {/* Dashboard Main Grid Layout */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Actions and Configurations (7 cols) */}
          <section className="lg:col-span-7 space-y-8">
            
            {/* Action Box: Upload & Mic Recording */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md">
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-teal-400" />
                1. Input Spoken Audio
              </h2>

              {/* Drag/Drop Canvas */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-200 ${
                  dragActive 
                    ? "border-teal-500 bg-teal-500/5 scale-[0.99]" 
                    : file 
                      ? "border-slate-800 bg-slate-950/20" 
                      : "border-slate-800/80 hover:border-slate-700 bg-slate-950/10"
                }`}
              >
                <input
                  type="file"
                  id="audio-upload"
                  className="hidden"
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                  disabled={isRecording || isTranscribing}
                />

                {isRecording ? (
                  /* Recording Active State */
                  <div className="flex flex-col items-center py-4">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-150" />
                      <div className="relative w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition duration-200" onClick={stopRecording}>
                        <Square className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <span className="text-red-400 font-mono font-bold text-lg animate-pulse mb-1">
                      REC {formatTime(recordingDuration)}
                    </span>
                    <span className="text-xs text-slate-400">Recording live micro-audio. Click square to stop.</span>
                    
                    {/* Pulsing Visual Wave representation */}
                    <div className="flex items-center gap-1.5 h-10 mt-6">
                      <div className="w-1 bg-red-500 rounded-full h-4 wave-bar" />
                      <div className="w-1 bg-red-500 rounded-full h-8 wave-bar" />
                      <div className="w-1 bg-red-500 rounded-full h-10 wave-bar" />
                      <div className="w-1 bg-red-500 rounded-full h-6 wave-bar" />
                      <div className="w-1 bg-red-500 rounded-full h-8 wave-bar" />
                      <div className="w-1 bg-red-500 rounded-full h-4 wave-bar" />
                    </div>
                  </div>
                ) : file ? (
                  /* Audio/Video File Selected State */
                  <div className="flex flex-col items-center py-3 text-center">
                    <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 rounded-full flex items-center justify-center mb-4 text-teal-400 shadow-sm">
                      {file.type.startsWith("video/") || /\.(mp4|mkv|avi|mov|flv|wmv|webm|m4v)$/i.test(file.name) ? (
                        <FileVideo className="w-6 h-6" />
                      ) : (
                        <FileAudio className="w-6 h-6" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-200 truncate max-w-xs sm:max-w-md block mb-1">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono mb-4">
                      ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>

                    {/* Integrated mini audio-player */}
                    {audioUrl && (
                      <div className="flex items-center gap-3.5 bg-slate-900 border border-slate-800/80 rounded-xl py-2 px-4 shadow-sm mb-6">
                        <button
                          onClick={togglePlay}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-teal-400 hover:text-teal-300 transition duration-150"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <span className="text-xs font-mono text-slate-400">Preview Player</span>
                        <audio 
                          ref={audioRef} 
                          src={audioUrl} 
                          onEnded={handleAudioEnded} 
                          className="hidden" 
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <label
                        htmlFor="audio-upload"
                        className="text-xs text-teal-400 hover:text-teal-300 underline cursor-pointer font-medium"
                      >
                        Choose another file
                      </label>
                      <span className="text-xs text-slate-600">or</span>
                      <button
                        onClick={startRecording}
                        className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer font-medium"
                      >
                        Record from mic
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Idle Select State */
                  <label htmlFor="audio-upload" className="w-full flex flex-col items-center justify-center cursor-pointer py-4">
                    <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-400 transition group-hover:text-slate-200 shadow-sm">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200 mb-1">
                      Drag & Drop Audio or Video File
                    </span>
                    <span className="text-xs text-slate-500 mb-4 text-center">
                      Supports any audio/video format (mp3, wav, m4a, mp4, mkv, avi, mov, flac, etc.)
                    </span>
                    <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800">
                      <span className="font-semibold text-teal-400 cursor-pointer hover:underline">Choose file</span>
                      <span className="text-slate-600 hidden sm:inline">|</span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          startRecording();
                        }}
                        className="font-semibold text-red-400 cursor-pointer hover:underline flex items-center gap-1"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Record audio live
                      </button>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Config Panel */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                2. Transcription Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Model selection */}
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Groq Whisper Model
                  </label>
                  <select
                    value={options.model}
                    onChange={(e) => setOptions(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500 transition"
                  >
                    <option value="whisper-large-v3">whisper-large-v3 (Accurate)</option>
                    <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Fast)</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                    Whisper large-v3 provides the absolute highest punctuation and language-switch accuracy.
                  </p>
                </div>

                {/* Speech Language Mode */}
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Speech Language Mode
                  </label>
                  <select
                    value={options.languageMode}
                    onChange={(e) => setOptions(prev => ({ ...prev, languageMode: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500 transition"
                  >
                    <option value="hinglish">Hinglish / Mixed (Hindi + English)</option>
                    <option value="hindi">Pure Hindi (Forces Devanagari)</option>
                    <option value="english">Pure English (Forces Latin)</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                    {options.languageMode === "hinglish" 
                      ? "Mixed audio. Preserves spelling of English words (e.g. 'explain') and transliterates Devanagari Hindi."
                      : options.languageMode === "hindi"
                        ? "Forces Whisper to output everything in Devanagari script."
                        : "Forces Whisper to output pure English."}
                  </p>
                </div>

                {/* Keep Devanagari Script Toggle */}
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    Transliteration Mode
                  </label>
                  <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                    <input
                      type="checkbox"
                      id="keep-devanagari-checkbox"
                      checked={options.keepDevanagari}
                      onChange={(e) => setOptions(prev => ({ ...prev, keepDevanagari: e.target.checked }))}
                      disabled={options.languageMode === "english"}
                      className="w-4 h-4 accent-teal-500 rounded border-slate-800 text-teal-500 focus:ring-teal-500 bg-slate-950 disabled:opacity-50"
                    />
                    <label htmlFor="keep-devanagari-checkbox" className={`text-sm font-medium text-slate-200 cursor-pointer select-none ${options.languageMode === "english" ? "opacity-50 cursor-not-allowed" : ""}`}>
                      Skip Romanization (Raw Hindi)
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                    If selected, output remains in standard Hindi Devanagari script (e.g. "नमस्ते").
                  </p>
                </div>

                {/* Custom Whisper Prompt */}
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Whisper Prompt / Hints (Optional)
                  </label>
                  <input
                    type="text"
                    value={options.customPrompt || ""}
                    onChange={(e) => setOptions(prev => ({ ...prev, customPrompt: e.target.value }))}
                    placeholder="e.g. Product names, jargon, punctuation guides"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500 transition"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                    Helps Whisper with spelling, rare words, names, or style.
                  </p>
                </div>
              </div>

              {/* Optional Custom API Key override field */}
              <div className="mt-6 border-t border-slate-800/60 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                    Groq API Key (Optional Override)
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">Overwrites environment key</span>
                </div>
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={handleTranscribe}
                  disabled={!file || isTranscribing || isRecording}
                  className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-md ${
                    !file || isRecording
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800/50"
                      : isTranscribing
                        ? "bg-teal-500/10 text-teal-300 border border-teal-500/30"
                        : "bg-teal-500 hover:bg-teal-400 text-slate-950 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  }`}
                >
                  {isTranscribing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing Audio & Romanizing locally...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Transcribe Audio to Hinglish
                    </>
                  )}
                </button>
              </div>
            </div>

          </section>

          {/* Right Column: Local CLI documentation and Setup steps (5 cols) */}
          <section className="lg:col-span-5 space-y-8">
            
            {/* Download/CLI Package Box */}
            <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/20 border border-slate-900 rounded-3xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-2.5 mb-3.5">
                <Terminal className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-mono font-bold tracking-tight text-slate-200">
                  STANDALONE PYTHON CLI BUNDLE
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Run this entire transcription engine completely locally on any low-spec machine! The Python CLI script communicates with Groq cloud and transliterates directly in your terminal.
              </p>

              {/* Steps */}
              <div className="space-y-4 border-t border-slate-800/60 pt-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/5 border border-teal-500/10 px-2 py-0.5 rounded-full uppercase">
                    Step 1: Install Python Dependencies
                  </span>
                  <div className="mt-2 bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
                      <code>pip install -r requirements.txt</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/5 border border-teal-500/10 px-2 py-0.5 rounded-full uppercase">
                    Step 2: Add API Key (.env)
                  </span>
                  <div className="mt-2 bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
                      <code>GROQ_API_KEY=gsk_your_key_here</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/5 border border-teal-500/10 px-2 py-0.5 rounded-full uppercase">
                    Step 3: Execute Command
                  </span>
                  <div className="mt-2 bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
                      <code>python transcriber.py audio.wav</code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Download Bundle Action button */}
              <a 
                href="/api/download-cli"
                className="mt-5 w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-150"
              >
                <Download className="w-3.5 h-3.5" />
                Download Python CLI Tools (.zip)
              </a>
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6">
              <h4 className="text-xs font-mono font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                HOW DOES IT WORK UNDER THE HOOD?
              </h4>
              <ul className="text-xs text-slate-500 space-y-2.5 list-disc pl-4 leading-relaxed">
                <li>Your speech audio is dispatched directly to Groq's high-speed Whisper Large v3 cloud API.</li>
                <li>We enforce Hindi transcription, ensuring Devanagari script is outputted (not translated to English).</li>
                <li>The Devanagari characters are translated locally using Python <code className="text-slate-400">aksharamukha</code> with Hindi schwa-deletion.</li>
                <li>English loanwords like <code className="text-slate-400">workout</code>, <code className="text-slate-400">office</code>, etc. are preserved completely in their natural Latin script.</li>
              </ul>
            </div>
          </section>
        </main>

        {/* Dynamic Display Panel: Transcription Output Results */}
        <AnimatePresence>
          {isTranscribing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 bg-slate-900/20 border border-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center text-center"
            >
              {/* Spinning Waves and Text */}
              <div className="flex items-center gap-2 h-8 mb-4">
                <div className="w-1 bg-teal-400 rounded-full h-4 wave-bar" />
                <div className="w-1 bg-teal-400 rounded-full h-8 wave-bar" />
                <div className="w-1 bg-teal-400 rounded-full h-10 wave-bar" />
                <div className="w-1 bg-teal-400 rounded-full h-6 wave-bar" />
                <div className="w-1 bg-teal-400 rounded-full h-8 wave-bar" />
                <div className="w-1 bg-teal-400 rounded-full h-4 wave-bar" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Transcribing and Romanizing...</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-normal">
                Audio file size checked. Directing Whisper transcript and running local Aksharamukha pipeline...
              </p>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error:</span> {error}
              </div>
            </motion.div>
          )}

          {result && !isTranscribing && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-bold text-slate-200">
                  Transcription Results
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadTranscript}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Transcript (.txt)
                  </button>
                </div>
              </div>

              {/* Split Screen Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Devanagari output box */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                      RAW DEVANAGARI HINDI
                    </span>
                    <button
                      onClick={() => copyText(result.rawHindi, "hindi")}
                      className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition"
                      title="Copy to Clipboard"
                    >
                      {copiedHindi ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-lg text-slate-200 leading-relaxed min-h-[100px] break-words whitespace-pre-wrap">
                    {result.rawHindi}
                  </div>
                </div>

                {/* Romanized output box */}
                <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/40 border border-slate-800 rounded-2xl p-5 relative shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-teal-400 bg-teal-500/5 px-2.5 py-1 rounded-md border border-teal-500/10">
                      ROMANIZED HINGLISH (WHATSAPP-STYLE)
                    </span>
                    <button
                      onClick={() => copyText(result.hinglish, "hinglish")}
                      className="p-1.5 text-teal-400 hover:text-teal-300 hover:bg-slate-800/80 rounded-lg transition"
                      title="Copy to Clipboard"
                    >
                      {copiedHinglish ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-xl font-medium text-teal-200 leading-relaxed min-h-[100px] break-words whitespace-pre-wrap">
                    {result.hinglish}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
