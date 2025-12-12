export interface ImageFilter {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sepia: number;
  grayscale: number;
}

export enum ImageCategory {
  PEOPLE = 'People',
  LANDSCAPES = 'Landscapes',
  ANIMALS = 'Animals',
  OBJECTS = 'Objects',
  INDOOR = 'Indoor',
  OUTDOOR = 'Outdoor',
  SELFIES = 'Selfies',
  OTHERS = 'Others',
  UNCATEGORIZED = 'Uncategorized'
}

export interface Photo {
  id: string;
  url: string;
  originalUrl: string; // For compare feature
  name: string;
  category: string;
  narration: string;
  audioNarrationUrl?: string; // Blob URL for recorded voice
  filters: ImageFilter;
  rotation: number; // 0, 90, 180, 270
}

export interface AppState {
  photos: Photo[];
  currentView: 'gallery' | 'editor' | 'slideshow' | 'audio';
  editingPhotoId: string | null;
  selectedAudio: string | null; // URL to background audio
  isAudioPlaying: boolean;
  audioVolume: number;
}

export const DEFAULT_FILTERS: ImageFilter = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  sepia: 0,
  grayscale: 0,
};

// Replaced with a reliable YouTube Audio Library track (Kevin MacLeod - A New Beginning)
export const DEMO_AUDIO_URL = "https://freepd.com/music/A%20New%20Beginning.mp3";