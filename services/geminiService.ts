import { GoogleGenAI, Modality } from "@google/genai";
import { Photo } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Converts an image URL (Blob or Remote) to a resized JPEG Base64 string.
 * Resizing is crucial to avoid "RPC failed" errors due to large payloads.
 */
export const fileToGenerativePart = async (url: string): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Create ImageBitmap to efficiently handle image data
    const imageBitmap = await createImageBitmap(blob);
    
    // Resize logic: Constrain max dimension to 1024px
    const maxDimension = 1024;
    let width = imageBitmap.width;
    let height = imageBitmap.height;
    
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    
    // Convert to JPEG with 0.8 quality to further optimize size
    const base64Url = canvas.toDataURL('image/jpeg', 0.8);
    const data = base64Url.split(',')[1];
    
    return {
      mimeType: 'image/jpeg',
      data
    };
  } catch (error) {
    console.error("Error processing image for Gemini:", error);
    return null;
  }
};

/**
 * Converts an audio URL (Blob) to Base64 string for Gemini
 */
export const audioToGenerativePart = async (url: string): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve({
          mimeType: blob.type || 'audio/wav',
          data: base64Data
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error processing audio for Gemini:", error);
    return null;
  }
};

const handleGeminiError = (error: any, context: string) => {
  if (
    error?.status === 429 || 
    error?.code === 429 || 
    error?.message?.includes('429') || 
    error?.message?.includes('quota') || 
    error?.status === "RESOURCE_EXHAUSTED"
  ) {
    console.warn(`Gemini API Quota Exceeded during ${context}. Using fallback.`);
    return;
  }
  console.error(`Gemini ${context} failed:`, error);
};

export const suggestCategory = async (photoUrl: string): Promise<string> => {
  if (!API_KEY) return "Uncategorized";

  try {
    const imageData = await fileToGenerativePart(photoUrl);
    if (!imageData) return "Uncategorized";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          },
          {
            text: "Analyze this image and categorize it into exactly one of these categories: People, Landscapes, Animals, Objects, Indoor, Outdoor, Selfies. Return ONLY the category name."
          }
        ]
      }
    });
    
    const text = response.text?.trim();
    return text || "Uncategorized";
  } catch (error) {
    handleGeminiError(error, 'categorization');
    return "Uncategorized";
  }
};

export const generateAutoNarration = async (photoUrl: string, tone: string): Promise<string> => {
  if (!API_KEY) return "API Key missing. Please provide a description manually.";

  try {
    const imageData = await fileToGenerativePart(photoUrl);
    if (!imageData) return "Could not process image.";

    const prompt = `Write a short, engaging caption (under 20 words) for this photo. Tone: ${tone}.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    handleGeminiError(error, 'narration');
    return "Could not generate narration.";
  }
};

export const transcribeAudio = async (audioUrl: string): Promise<string> => {
  if (!API_KEY) return "API Key missing.";

  try {
    const audioData = await audioToGenerativePart(audioUrl);
    if (!audioData) return "Could not process audio data.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioData.mimeType,
              data: audioData.data
            }
          },
          {
            text: "Transcribe the spoken audio into text. Return only the transcription text, no other commentary."
          }
        ]
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    handleGeminiError(error, 'transcription');
    return "";
  }
};

export const stylizeImage = async (photoUrl: string, style: string): Promise<string | null> => {
  if (!API_KEY) {
     console.error("API Key missing");
     return null;
  }

  try {
    const imageData = await fileToGenerativePart(photoUrl);
    if (!imageData) return null;

    // Use gemini-2.5-flash-image for image editing/stylization
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          },
          {
            text: `Redraw this image in a ${style} style. Maintain the original composition and subject matter. High quality, detailed.`
          }
        ]
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    handleGeminiError(error, 'stylization');
    return null;
  }
};

export const removeObject = async (photoUrl: string, objectDescription: string): Promise<string | null> => {
  if (!API_KEY) {
     console.error("API Key missing");
     return null;
  }

  try {
    const imageData = await fileToGenerativePart(photoUrl);
    if (!imageData) return null;

    // Use gemini-2.5-flash-image for image editing
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          },
          {
            text: `Remove the ${objectDescription} from this image. Fill in the background naturally to match the surroundings.`
          }
        ]
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    handleGeminiError(error, 'object removal');
    return null;
  }
};

export const removeObjectAtPoint = async (photoUrl: string, x: number, y: number): Promise<string | null> => {
  if (!API_KEY) {
     console.error("API Key missing");
     return null;
  }

  try {
    // 1. Fetch the image locally to manipulate it
    const response = await fetch(photoUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // 2. Create a canvas to draw the "mask"
    // We resize to a reasonable max dimension to save tokens/bandwidth, similar to fileToGenerativePart
    const maxDimension = 1024;
    let width = imageBitmap.width;
    let height = imageBitmap.height;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw original image
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // 3. Draw a red circle at the clicked position
    // x and y are normalized (0-1), so map to canvas dimensions
    const centerX = x * width;
    const centerY = y * height;
    
    // Brush size: 5% of the smaller dimension, but at least 20px
    const radius = Math.max(20, Math.min(width, height) * 0.05);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FF0000'; // Pure red
    ctx.fill();

    // 4. Convert to base64
    const base64Url = canvas.toDataURL('image/jpeg', 0.85);
    const data = base64Url.split(',')[1];

    // 5. Send to Gemini
    const apiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data
            }
          },
          {
            text: `Remove the object covered by the red circle and the red circle itself. Fill in the background naturally to match the surroundings.`
          }
        ]
      }
    });

    if (apiResponse.candidates?.[0]?.content?.parts) {
      for (const part of apiResponse.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;

  } catch (error) {
    handleGeminiError(error, 'object removal at point');
    return null;
  }
};

// Helper to convert PCM to WAV for playback
const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000) => {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);
  
  // Write PCM data
  new Uint8Array(buffer, 44).set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!API_KEY) return null;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Decode Base64 to binary
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert raw PCM to WAV blob
      const wavBlob = pcmToWav(bytes);
      return URL.createObjectURL(wavBlob);
    }
    return null;
  } catch (error) {
    handleGeminiError(error, 'speech generation');
    return null;
  }
};

/**
 * Generates a "song" or musical track using TTS with specific prompting/voices.
 * This simulates music generation using the available speech model.
 */
export const generateAiTrack = async (category: string): Promise<{ url: string; name: string } | null> => {
  if (!API_KEY) return null;

  let prompt = "";
  let voiceName = "Kore";
  let trackName = "";

  // Simplified prompts to ensure API stability and avoid 500 errors
  switch (category) {
    case 'Cinematic':
      prompt = "Hum a slow, deep, and dramatic melody.";
      voiceName = "Fenrir";
      trackName = "Epic Echoes (AI)";
      break;
    case 'Upbeat':
      prompt = "Beatbox a simple, fast, and energetic rhythm.";
      voiceName = "Puck";
      trackName = "Rhythm Burst (AI)";
      break;
    case 'Default':
    default:
      prompt = "Hum a soft and soothing lullaby.";
      voiceName = "Kore";
      trackName = "Gentle Breeze (AI)";
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const wavBlob = pcmToWav(bytes);
      return {
        url: URL.createObjectURL(wavBlob),
        name: trackName
      };
    }
    return null;
  } catch (error) {
    handleGeminiError(error, 'music generation');
    return null;
  }
};