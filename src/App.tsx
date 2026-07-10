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
  Volume2,
  Plus,
  X,
  Tag
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
    customPrompt: "Innova Crysta, Toyota, Service Center, budget friendly, interior, exterior, kilometre, lakh, Gurgaon, Delhi, EMI, finance, booking"
  });
  const [customKey, setCustomKey] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  
  // Spelling & Vocabulary Editor States
  const [editorMode, setEditorMode] = useState<"tags" | "raw">("tags");
  const [vocabTags, setVocabTags] = useState<string[]>([
    "Innova Crysta", "Toyota", "Service Center", "budget friendly", "interior", "exterior", "kilometre", "lakh", "Gurgaon", "Delhi", "EMI", "finance", "booking"
  ]);
  const [tagInput, setTagInput] = useState<string>("");
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

  // Tab State & Command Copy State
  const [activeTab, setActiveTab] = useState<"transcribe" | "cli">("transcribe");
  const [copiedCmdIndex, setCopiedCmdIndex] = useState<number | null>(null);

  const copyCommand = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCmdIndex(index);
    setTimeout(() => setCopiedCmdIndex(null), 1500);
  };

  // Auto clean audio ref on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  // Sync vocabTags with options.customPrompt when in tags mode
  useEffect(() => {
    if (editorMode === "tags") {
      setOptions(prev => ({ ...prev, customPrompt: vocabTags.join(", ") }));
    }
  }, [vocabTags, editorMode]);

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

  // Tag helpers
  const addTag = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && !vocabTags.includes(trimmed)) {
      setVocabTags(prev => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (indexToRemove: number) => {
    setVocabTags(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const loadPreset = (presetName: "cars" | "tech" | "medical" | "clear") => {
    if (presetName === "cars") {
      setVocabTags(["Innova Crysta", "Toyota", "Service Center", "budget friendly", "interior", "exterior", "kilometre", "lakh", "Gurgaon", "Delhi", "EMI", "finance", "booking"]);
    } else if (presetName === "tech") {
      setVocabTags(["SaaS", "API", "microservices", "database", "React", "Node.js", "deployment", "pipeline", "cloud", "serverless", "scaling"]);
    } else if (presetName === "medical") {
      setVocabTags(["clinic", "prescription", "dosage", "symptoms", "diagnosis", "therapy", "doctor", "health insurance"]);
    } else {
      setVocabTags([]);
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
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-x-hidden">
      
      {/* Decorative Background Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full filter blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full filter blur-[110px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <header className="mb-8 pb-6 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 shadow-md">
                <AudioLines className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-[11px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                Whisper Romanizer v2.2
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-slate-100">
              Cloud Audio-to-Hinglish Transcriber
            </h1>
            <p className="mt-1.5 text-slate-400 max-w-2xl text-xs sm:text-sm leading-relaxed">
              Record or upload spoken Hindi speech and transcribe it directly into romanized, WhatsApp-style Hinglish using Groq Whisper. Real-time local schwa-deletion ensures native spelling accuracy.
            </p>
          </div>

          {/* Header Action Button (Download Zip) */}
          <div className="flex items-center">
            <a 
              href="/api/download-cli"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition duration-150 shadow-sm"
              title="Download standalone local CLI Python package"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Download Local CLI (.zip)
            </a>
          </div>
        </header>

        {/* Dynamic Warning Alert: Missing API Key */}
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3.5 backdrop-blur-sm">
          <AlertCircle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200 leading-relaxed">
            <span className="font-semibold text-amber-300">Prerequisite Configured Server Key:</span> The transcriber uses the <code className="text-xs bg-slate-950 border border-slate-800/60 px-1.5 py-0.5 rounded text-amber-200 font-mono">GROQ_API_KEY</code> set in your environment. You can configure this key via the Secrets/Settings menu in the AI Studio UI, or supply an override key in the options panel below.
          </div>
        </div>

        {/* Modern Tab Bar Switcher */}
        <div className="flex border-b border-slate-800 mb-8 gap-1">
          <button
            onClick={() => setActiveTab("transcribe")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
              activeTab === "transcribe"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 rounded-t-xl"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Web Workspace
          </button>
          <button
            onClick={() => setActiveTab("cli")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
              activeTab === "cli"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5 rounded-t-xl"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 rounded-t-xl"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Local Python CLI
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "transcribe" ? (
            <motion.div
              key="workspace-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left Column: Actions and Configurations (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Card 1: Upload & Mic Recording */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 relative overflow-hidden shadow-sm backdrop-blur-md">
                  <h2 className="text-[10px] font-bold font-mono tracking-wider text-slate-400 mb-4 flex items-center gap-2 uppercase">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    1. Input Spoken Audio
                  </h2>

                  {/* Drag/Drop Canvas */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all duration-200 ${
                      dragActive 
                        ? "border-indigo-500 bg-indigo-500/10 scale-[0.99]" 
                        : file 
                          ? "border-slate-800 bg-slate-950/40" 
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
                      <div className="flex flex-col items-center py-4 text-center">
                        <div className="relative mb-5">
                          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-150" />
                          <div className="relative w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-pointer shadow-md transition duration-200" onClick={stopRecording}>
                            <Square className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <span className="text-red-400 font-mono font-bold text-base animate-pulse mb-1">
                          REC {formatTime(recordingDuration)}
                        </span>
                        <span className="text-[11px] text-slate-400">Recording live. Click stop icon to finalize.</span>
                        
                        {/* Pulsing Visual Wave representation */}
                        <div className="flex items-center gap-1 h-6 mt-4">
                          <div className="w-0.5 bg-red-500 rounded-full h-2 animate-[pulse_0.8s_infinite]" />
                          <div className="w-0.5 bg-red-500 rounded-full h-4 animate-[pulse_1s_infinite_0.1s]" />
                          <div className="w-0.5 bg-red-500 rounded-full h-5 animate-[pulse_1.2s_infinite_0.2s]" />
                          <div className="w-0.5 bg-red-500 rounded-full h-3 animate-[pulse_0.9s_infinite_0.3s]" />
                          <div className="w-0.5 bg-red-500 rounded-full h-4 animate-[pulse_1.1s_infinite_0.4s]" />
                          <div className="w-0.5 bg-red-500 rounded-full h-2 animate-[pulse_0.7s_infinite_0.5s]" />
                        </div>
                      </div>
                    ) : file ? (
                      /* Audio/Video File Selected State */
                      <div className="flex flex-col items-center py-2 text-center w-full">
                        <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-300 shadow-sm">
                          {file.type.startsWith("video/") || /\.(mp4|mkv|avi|mov|flv|wmv|webm|m4v)$/i.test(file.name) ? (
                            <FileVideo className="w-5 h-5" />
                          ) : (
                            <FileAudio className="w-5 h-5" />
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-full block mb-1 px-4">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mb-4">
                          ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>

                        {/* Integrated mini audio-player */}
                        {audioUrl && (
                          <div className="flex items-center gap-3 bg-slate-950 border border-slate-850 rounded-lg py-1.5 px-3 shadow-sm mb-4">
                            <button
                              onClick={togglePlay}
                              className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-indigo-400 hover:text-indigo-300 transition duration-150"
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <span className="text-[10px] font-mono text-slate-400">Preview Player</span>
                            <audio 
                              ref={audioRef} 
                              src={audioUrl} 
                              onEnded={handleAudioEnded} 
                              className="hidden" 
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <label
                            htmlFor="audio-upload"
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer font-semibold"
                          >
                            Choose other
                          </label>
                          <span className="text-xs text-slate-500">or</span>
                          <button
                            onClick={startRecording}
                            className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer font-semibold"
                          >
                            Record new
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Idle Select State */
                      <label htmlFor="audio-upload" className="w-full flex flex-col items-center justify-center cursor-pointer py-3 text-center">
                        <div className="w-12 h-12 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-center mb-3 text-slate-400 shadow-sm">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-semibold text-slate-200 mb-1">
                          Drag & Drop Audio or Video File
                        </span>
                        <span className="text-[10px] text-slate-400 mb-3 leading-tight max-w-[220px]">
                          Supports mp3, wav, m4a, flac, mp4, mkv, etc.
                        </span>
                        <div className="flex flex-col sm:flex-row items-center gap-2 text-[11px] text-slate-400 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-850 shadow-sm">
                          <span className="font-semibold text-indigo-400 cursor-pointer hover:underline">Choose file</span>
                          <span className="text-slate-600 hidden sm:inline">|</span>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              startRecording();
                            }}
                            className="font-semibold text-red-400 cursor-pointer hover:underline flex items-center gap-1"
                          >
                            <Mic className="w-3 h-3" />
                            Record audio live
                          </button>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Card 2: Transcription Settings */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-sm space-y-4 backdrop-blur-md">
                  <h2 className="text-[10px] font-bold font-mono tracking-wider text-slate-400 flex items-center gap-2 uppercase">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    2. Settings
                  </h2>

                  {/* Model selection */}
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Groq Whisper Model
                    </label>
                    <select
                      value={options.model}
                      onChange={(e) => setOptions(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-slate-950 transition"
                    >
                      <option value="whisper-large-v3">whisper-large-v3 (Highly Accurate)</option>
                      <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Ultra Fast)</option>
                    </select>
                  </div>

                  {/* Speech Language Mode */}
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Speech Language Mode
                    </label>
                    <select
                      value={options.languageMode}
                      onChange={(e) => setOptions(prev => ({ ...prev, languageMode: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 bg-slate-950 focus:outline-none focus:border-indigo-500 focus:bg-slate-950 transition"
                    >
                      <option value="hinglish">Hinglish / Mixed (Hindi + English)</option>
                      <option value="hindi">Pure Hindi (Forces Devanagari)</option>
                      <option value="english">Pure English (Forces Latin)</option>
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500 leading-normal">
                      {options.languageMode === "hinglish" 
                        ? "Mixed speech. Spelt English words are preserved, and Devanagari Hindi is Romanized."
                        : options.languageMode === "hindi"
                          ? "Forces standard Hindi Devanagari text."
                          : "Forces pure English text."}
                    </p>
                  </div>

                  {/* Keep Devanagari Script Toggle */}
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Transliteration Mode
                    </label>
                    <div className="flex items-center gap-3.5 bg-slate-950 border border-slate-850 rounded-lg p-2.5">
                      <input
                        type="checkbox"
                        id="keep-devanagari-checkbox"
                        checked={options.keepDevanagari}
                        onChange={(e) => setOptions(prev => ({ ...prev, keepDevanagari: e.target.checked }))}
                        disabled={options.languageMode === "english"}
                        className="w-4 h-4 accent-indigo-500 rounded border-slate-800 text-indigo-500 focus:ring-indigo-500 bg-slate-950 disabled:opacity-30"
                      />
                      <label htmlFor="keep-devanagari-checkbox" className={`text-xs font-semibold text-slate-300 cursor-pointer select-none ${options.languageMode === "english" ? "opacity-30 cursor-not-allowed" : ""}`}>
                        Skip Romanization (Raw Hindi)
                      </label>
                    </div>
                  </div>

                  {/* Highly Improved Interactive Spelling & Vocabulary Editor */}
                  <div className="space-y-3.5 bg-slate-950/40 p-4 border border-slate-850 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                          Spelling & Domain Hints Editor
                        </label>
                      </div>
                      
                      {/* Mode selection switcher buttons */}
                      <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setEditorMode("tags")}
                          className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md transition ${
                            editorMode === "tags" 
                              ? "bg-indigo-600 text-white shadow-sm" 
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Smart Tags
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode("raw")}
                          className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md transition ${
                            editorMode === "raw" 
                              ? "bg-indigo-600 text-white shadow-sm" 
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Raw Prompt
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-normal">
                      Guide Whisper's transcription engine to prevent spelling aberrations and domain drift (e.g., Maserati, budget-friendly).
                    </p>

                    {editorMode === "tags" ? (
                      <div className="space-y-3">
                        {/* Interactive Tag Area */}
                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-2 bg-slate-950/60 rounded-lg border border-slate-900 scrollbar-thin">
                          {vocabTags.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic py-1 px-1">No keywords loaded. Type some below or load a preset!</span>
                          ) : (
                            vocabTags.map((tag, index) => (
                              <motion.span
                                key={`${tag}-${index}`}
                                layoutId={`vocab-tag-${tag}-${index}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md hover:bg-indigo-500/15 transition group"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(index)}
                                  className="text-indigo-400/50 hover:text-indigo-350 group-hover:scale-110 transition p-0.5 rounded"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </motion.span>
                            ))
                          )}
                        </div>

                        {/* Tag entry input field */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.endsWith(",")) {
                                addTag(val.slice(0, -1));
                              } else {
                                setTagInput(val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTag(tagInput);
                              }
                            }}
                            placeholder="Add domain term (press Enter or comma)..."
                            className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => addTag(tagInput)}
                            className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white p-1.5 rounded-lg flex items-center justify-center transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Fast Presets Grid */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-wider block">
                            Quick-Load Vocabulary Presets
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => loadPreset("cars")}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-[10px] font-medium text-slate-300 flex items-center gap-1 transition"
                            >
                              🚗 Used Cars
                            </button>
                            <button
                              type="button"
                              onClick={() => loadPreset("tech")}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-[10px] font-medium text-slate-300 flex items-center gap-1 transition"
                            >
                              💻 Tech SaaS
                            </button>
                            <button
                              type="button"
                              onClick={() => loadPreset("medical")}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-[10px] font-medium text-slate-300 flex items-center gap-1 transition"
                            >
                              🏥 Medical
                            </button>
                            <button
                              type="button"
                              onClick={() => loadPreset("clear")}
                              className="px-2 py-1 bg-slate-900/40 hover:bg-red-950/20 hover:border-red-900 border border-slate-800/80 rounded-md text-[10px] font-medium text-red-400 flex items-center gap-1 transition ml-auto"
                            >
                              🧹 Clear All
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Classic Textarea raw prompt */
                      <div>
                        <textarea
                          rows={4}
                          value={options.customPrompt || ""}
                          onChange={(e) => setOptions(prev => ({ ...prev, customPrompt: e.target.value }))}
                          placeholder="Provide a comma-separated vocabulary list or contextual paragraph to bias spelling recognition..."
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 font-sans focus:outline-none focus:border-indigo-500 focus:bg-slate-950 transition resize-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Optional Custom API Key override field */}
                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                        Groq API Key (Override)
                      </label>
                      <span className="text-[9px] text-slate-500 font-medium">Optional</span>
                    </div>
                    <input
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-indigo-500 focus:bg-slate-950 transition"
                    />
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleTranscribe}
                      disabled={!file || isTranscribing || isRecording}
                      className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 shadow-sm ${
                        !file || isRecording
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800/40"
                          : isTranscribing
                            ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-md shadow-indigo-950/40"
                      }`}
                    >
                      {isTranscribing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Processing audio...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Transcribe & Romanize
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: Transcription Output Workspace (7 cols) */}
              <div className="lg:col-span-7 h-full flex flex-col min-h-[550px]">
                
                {/* Loader State */}
                {isTranscribing && (
                  <div className="flex-1 bg-slate-900/10 border border-slate-900 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-1.5 h-8 mb-5">
                      <div className="w-1 bg-indigo-500 rounded-full h-4 wave-bar animate-[pulse_0.8s_infinite]" />
                      <div className="w-1 bg-indigo-500 rounded-full h-8 wave-bar animate-[pulse_1s_infinite_0.1s]" />
                      <div className="w-1 bg-indigo-500 rounded-full h-10 wave-bar animate-[pulse_1.2s_infinite_0.2s]" />
                      <div className="w-1 bg-indigo-500 rounded-full h-6 wave-bar animate-[pulse_0.9s_infinite_0.3s]" />
                      <div className="w-1 bg-indigo-500 rounded-full h-8 wave-bar animate-[pulse_1.1s_infinite_0.4s]" />
                      <div className="w-1 bg-indigo-500 rounded-full h-4 wave-bar animate-[pulse_0.7s_infinite_0.5s]" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 mb-1">Transcribing & localizing phonetics...</h3>
                    <p className="text-xs text-slate-500 max-w-sm leading-normal">
                      We check audio segment parameters, stream transcription to Groq Whisper cloud, and process schwa-deletions locally with Aksharamukha pipeline.
                    </p>
                  </div>
                )}

                {/* Error State */}
                {error && !isTranscribing && (
                  <div className="flex-1 p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-3.5 text-red-400 text-xs shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                    <div>
                      <span className="font-bold text-red-400">Transcription Error:</span> {error}
                      <p className="mt-2 text-[11px] text-red-400/80 leading-normal">
                        Please check that your server environment or Settings panel has a valid Groq API key set. If uploading large files, ensure they are in proper audio/video codecs.
                      </p>
                    </div>
                  </div>
                )}

                {/* Idle / Awaiting State */}
                {!result && !isTranscribing && !error && (
                  <div className="flex-1 bg-slate-900/10 border border-slate-900 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm min-h-[450px]">
                    <div className="w-16 h-16 bg-slate-900 border border-slate-850 rounded-full flex items-center justify-center text-slate-500 mb-5 shadow-sm">
                      <AudioLines className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1.5">Awaiting Spoken Audio</h3>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                      Upload an audio or video file or record spoken speech from your microphone. Click <span className="font-semibold text-indigo-400">Transcribe & Romanize</span> to process. Output comparisons will display here.
                    </p>
                  </div>
                )}

                {/* Success Output State */}
                {result && !isTranscribing && !error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 space-y-6 flex flex-col"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-200">
                          Transcription Workspace
                        </h2>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Output processed in {(result.duration_ms / 1000).toFixed(2)}s using {options.model}
                        </p>
                      </div>
                      <button
                        onClick={downloadTranscript}
                        className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg transition shadow-sm font-semibold"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        Save Transcript (.txt)
                      </button>
                    </div>

                    {/* Split View Content Display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                      
                      {/* Box 1: Raw Devanagari */}
                      <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 flex flex-col h-full min-h-[300px] shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            RAW TRANSCRIPTION
                          </span>
                          <button
                            onClick={() => copyText(result.rawHindi, "hindi")}
                            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded border border-transparent hover:border-slate-800 transition"
                            title="Copy Raw Text"
                          >
                            {copiedHindi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="flex-1 text-slate-200 leading-relaxed text-sm break-words whitespace-pre-wrap font-sans">
                          {result.rawHindi}
                        </div>
                      </div>

                      {/* Box 2: Romanized Output */}
                      <div className="bg-gradient-to-br from-indigo-500/10 to-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full min-h-[300px] shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full filter blur-xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between mb-3 border-b border-indigo-500/20 pb-2 relative z-10">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            ROMANIZED HINGLISH
                          </span>
                          <button
                            onClick={() => copyText(result.hinglish, "hinglish")}
                            className="p-1 text-indigo-400 hover:text-indigo-350 hover:bg-indigo-950/60 rounded border border-transparent hover:border-indigo-500/20 transition"
                            title="Copy Hinglish Text"
                          >
                            {copiedHinglish ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="flex-1 text-indigo-200 font-medium leading-relaxed text-base break-words whitespace-pre-wrap font-sans relative z-10">
                          {result.hinglish}
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

              </div>
            </motion.div>
          ) : (
            <motion.div
              key="cli-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {/* Standalone Local Script Documentation */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 md:p-8 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <Terminal className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">
                        STANDALONE PYTHON CLI BUNDLE
                      </h3>
                      <p className="text-xs text-slate-400">
                        Execute extreme-speed transliteration pipeline completely on your local computer
                      </p>
                    </div>
                  </div>
                  
                  <a 
                    href="/api/download-cli"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition duration-150 shadow-md shadow-indigo-950/40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download ZIP
                  </a>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Want to skip browser uploads entirely? This app bundles the entire core romanizer as a standalone command line tool. It utilizes Groq APIs for Cloud Whisper transcription, then formats the output with a local Python-based phonetic engine.
                </p>

                {/* Code Steps */}
                <div className="space-y-5">
                  
                  {/* Step 1 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                        Step 1: Install Python Dependencies
                      </span>
                      <button
                        onClick={() => copyCommand("pip install -r requirements.txt", 1)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                      >
                        {copiedCmdIndex === 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedCmdIndex === 1 ? "Copied" : "Copy Command"}
                      </button>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-900">
                      <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
                        <code>pip install -r requirements.txt</code>
                      </pre>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                        Step 2: Add API Key (.env file)
                      </span>
                      <button
                        onClick={() => copyCommand("GROQ_API_KEY=gsk_your_key_here", 2)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                      >
                        {copiedCmdIndex === 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedCmdIndex === 2 ? "Copied" : "Copy Command"}
                      </button>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-900">
                      <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
                        <code>GROQ_API_KEY=gsk_your_key_here</code>
                      </pre>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                        Step 3: Run Standalone Command
                      </span>
                      <button
                        onClick={() => copyCommand("python transcriber.py audio.wav", 3)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                      >
                        {copiedCmdIndex === 3 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedCmdIndex === 3 ? "Copied" : "Copy Command"}
                      </button>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-900">
                      <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
                        <code>python transcriber.py audio.wav</code>
                      </pre>
                    </div>
                  </div>

                </div>
              </div>

              {/* Technical Under the Hood Details */}
              <div className="bg-slate-900/10 border border-slate-900 rounded-2xl p-6">
                <h4 className="text-xs font-mono font-bold text-slate-400 mb-4 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  HOW THE PIPELINE TRANSPILES AUDIO
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400 leading-relaxed">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-200">1. Hybrid Script Recognition</p>
                    <p>
                      Spoken Hindi audio with loanwords (English jargon) is directed to the Groq cloud. Whisper output formats Hindi phonetics in Devanagari script, leaving English loanwords naturally in Roman script.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-200">2. Real-time Romanization</p>
                    <p>
                      The local transliterator uses an advanced <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">aksharamukha</code> phonetic map configured with Hindi-specific schwa-deletion. It translates characters cleanly into readable, colloquial Roman script.
                    </p>
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
