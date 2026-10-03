/** SCL (messaging + calls) API shapes. */

export interface ConversationUser {
  id: string;
  name: string;
  image: string | null;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
  user: ConversationUser;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  url: string;
  storageKey: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  durationSec: number | null;
  name: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "VOICE" | "IMAGE" | "VIDEO" | "FILE" | "SYSTEM";
  content: string | null;
  createdAt: string;
  sender: ConversationUser;
  attachment: MessageAttachment | null;
}

export interface Conversation {
  id: string;
  type: "DIRECT" | "GROUP";
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
}

export interface ConversationSummary extends Conversation {
  lastMessage: Message | null;
  unreadCount: number;
}

export interface CallParty {
  id: string;
  name: string;
  image: string | null;
}

export interface Call {
  id: string;
  conversationId: string | null;
  callerId: string;
  recipientId: string;
  type: "AUDIO" | "VIDEO";
  status: "RINGING" | "ACCEPTED" | "REJECTED" | "MISSED" | "ENDED" | "FAILED";
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  createdAt: string;
  caller: CallParty;
  recipient: CallParty;
}

/** Payloads delivered over Socket.IO. */
export interface MessagePayload {
  conversationId: string;
  message: Message;
}

export interface ReadPayload {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}
