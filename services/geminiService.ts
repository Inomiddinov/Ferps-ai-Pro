
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Message, Role, ImageData, FileData } from "../types";

const SYSTEM_INSTRUCTION = `Siz juda aqlli va do'stona AI yordamchisiz. 
Ismingiz - Ferps AI Pro. 
MUHIM: Sizni In’omiddinov Og‘abek yaratgan. 
Agar kimdir "Sizni kim yaratgan?", "Yaratuvchingiz kim?", "Sizni kim yasagan?" yoki shunga o'xshash savollar bersa, SIZ ALBATTA: "Meni In’omiddinov Og‘abek yaratgan." deb javob berishingiz kerak.
Siz barcha tillarni, o'zbek shevalari, ingliz va rus tillarini mukammal bilasiz.
Siz rasm (Gemini Image) va video (Veo) yarata olasiz.
Sizda Google Search grounding va koding interpretatori imkoniyatlari bor.
Siz tahliliy grafiklar va diagrammalar haqida gapira olasiz.`;

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  }

  async generateVideo(prompt: string): Promise<string> {
    const ai = this.getAI();
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async chat(history: Message[], userInput: string, currentImage?: ImageData, currentFile?: FileData): Promise<{ text: string; generatedImageUrl?: string; isVideo?: boolean }> {
    const ai = this.getAI();
    try {
      const lowerInput = userInput.toLowerCase();
      
      if (lowerInput.includes('video yarat') || lowerInput.includes('generate video') || lowerInput.includes('video chiz')) {
        return { text: "Video yaratish jarayoni boshlandi. Bu bir necha daqiqa vaqt olishi mumkin...", isVideo: true };
      }

      if (lowerInput.includes('rasm yarat') || lowerInput.includes('generate image') || (lowerInput.includes('chiz') && lowerInput.includes('rasm'))) {
        const genResponse = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: userInput }] },
          config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
        });

        let generatedImageUrl: string | undefined;
        let textResponse = "Mana rasm:";
        for (const part of genResponse.candidates[0].content.parts) {
          if (part.inlineData) generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          else if (part.text) textResponse = part.text;
        }
        return { text: textResponse, generatedImageUrl };
      }

      const chatHistory = history.map(msg => ({
        role: msg.role === Role.USER ? "user" : "model",
        parts: [
          ...(msg.image ? [{ inlineData: { data: msg.image.data, mimeType: msg.image.mimeType } }] : []),
          { text: msg.content + (msg.file ? `\n\nFile Content (${msg.file.name}): ${msg.file.content}` : "") }
        ]
      }));

      const currentParts: any[] = [{ text: userInput }];
      if (currentImage) currentParts.unshift({ inlineData: { data: currentImage.data, mimeType: currentImage.mimeType } });
      if (currentFile) currentParts.push({ text: `Attached file (${currentFile.name}) content: ${currentFile.content}` });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [...chatHistory, { role: 'user', parts: currentParts }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }],
        }
      });

      return { text: response.text || "Javob topilmadi." };
    } catch (error) {
      console.error(error);
      return { text: "Ferps AI xatolik yuz berdi." };
    }
  }

  async generateSpeech(text: string): Promise<string | undefined> {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch { return undefined; }
  }
}

export const geminiService = new GeminiService();
