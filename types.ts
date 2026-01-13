
export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant'
}

export interface ImageData {
  data: string; // base64
  mimeType: string;
}

export interface FileData {
  name: string;
  content: string; // extracted text content
  type: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  image?: ImageData;
  generatedImageUrl?: string;
  videoUrl?: string;
  file?: FileData;
  timestamp: Date;
  isEdited?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  avatar?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalMessages: number;
  activeSessions: number;
  systemHealth: 'Healthy' | 'Degraded' | 'Maintenance';
}
