import { Avatar, AvatarFallback } from "./ui/avatar";
import { User, Cloud } from "lucide-react";

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp: string;
}

export function ChatMessage({ message, isUser, timestamp }: ChatMessageProps) {
  return (
    <div className={`flex gap-3 py-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar: 40x40px with 20x20px icon (M3 spec) */}
      <Avatar className={`w-10 h-10 flex-shrink-0 ${isUser ? "bg-[#111111]" : "bg-[#E5E7EB]"}`}>
        <AvatarFallback className={`bg-transparent ${isUser ? "text-white" : "text-[#6B7280]"}`}>
          {isUser ? <User size={18} /> : <Cloud size={20} />}
        </AvatarFallback>
      </Avatar>
      
      {/* Message container */}
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[70%]`}>
        {/* Message bubble: Large corners (16px), proper padding (16px horizontal, 12px vertical) */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-[#E5E7EB] text-[#111827]"
              : "bg-[#ffffff] text-[#111827]"
          }`}
        >
          {/* Body Large typography (16px, 0.5px letter-spacing) */}
          <p className="md-body-large whitespace-pre-wrap">{message}</p>
        </div>
        {/* Timestamp: Label Small (11px, 0.5px spacing), on-surface-variant color */}
        <span className="md-label-small text-[#6B7280] mt-1 px-2">{timestamp}</span>
      </div>
    </div>
  );
}
