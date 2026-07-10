export interface TranscriptionResult {
  success: boolean;
  rawHindi: string;
  hinglish: string;
}

export interface TranscriberOptions {
  model: string;
  keepDevanagari: boolean;
}
