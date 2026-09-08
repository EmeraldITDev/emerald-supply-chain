import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getScmRole } from "@/utils/scmRole";
import { apiRequest } from "@/services/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiChatReply {
  reply: string;
  model?: string | null;
}

const getGreeting = (role: string) => {
  switch (role) {
    case "procurement_manager":
    case "procurement":
      return "Hi! I can help you manage MRFs, RFQs, POs, and vendor workflows. What do you need?";
    case "supply_chain_director":
    case "supply_chain":
      return "Hi! I can help you with approvals, PO signing, and logistics oversight. What do you need?";
    case "executive":
    case "director":
      return "Hi! I can help you review and approve requests, or create new MRFs and SRFs. What do you need?";
    case "logistics_manager":
    case "logistics":
    case "logistics_officer":
      return "Hi! I can help you with trip requests, fleet management, and journey tracking. What do you need?";
    case "chairman":
      return "Hi! I can help you with high-value approvals and navigating the chairman dashboard. What do you need?";
    case "vendor":
      return "Hi! I can help you with RFQs, quotations, invoices, and your vendor portal. What do you need?";
    default:
      return "Hi! I can help you create requests, track their status, and navigate the platform. What do you need?";
  }
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const stripActionBlock = (reply: string) =>
  reply.replace(/\n?ACTION:\{.*\}\s*$/s, "").trim();

export const AIChatbot = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = getScmRole(user) || user?.role || "employee";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "assistant",
      content: getGreeting(role),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const greetingRoleRef = useRef(role);

  useEffect(() => {
    if (greetingRoleRef.current === role) return;
    greetingRoleRef.current = role;
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [
          {
            role: "assistant",
            content: getGreeting(role),
            timestamp: new Date(),
          },
        ];
      }
      return prev;
    });
  }, [role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, pendingNavigation]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setPendingNavigation(null);

    const historyForApi = messages
      .filter((_, index) => !(index === 0 && messages[0]?.role === "assistant"))
      .slice(-10)
      .map(({ role: msgRole, content }) => ({ role: msgRole, content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      const response = await apiRequest<AiChatReply>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: userMessage,
          history: historyForApi,
        }),
      });

      if (response.success && response.data?.reply) {
        const reply = response.data.reply;
        const actionMatch = reply.match(/ACTION:(\{.*\})\s*$/s);

        if (actionMatch) {
          try {
            const action = JSON.parse(actionMatch[1]) as {
              type?: string;
              path?: string;
            };
            const cleanReply = stripActionBlock(reply);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: cleanReply || reply,
                timestamp: new Date(),
              },
            ]);
            if (action.type === "navigate" && action.path) {
              setPendingNavigation(action.path);
            }
          } catch {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: reply, timestamp: new Date() },
            ]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: reply, timestamp: new Date() },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              response.error ||
              "Sorry, I could not reach the AI service. Please try again.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I could not reach the AI service. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      <Button
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-float hover:shadow-glow transition-all duration-300",
          isOpen && "scale-0 opacity-0"
        )}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Card
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[380px] h-[500px] shadow-xl transition-all duration-300 flex flex-col backdrop-blur-glass border-2",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b gradient-primary">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Assistant</h3>
              <p className="text-xs text-white/80">Always here to help</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-white hover:bg-white/20"
            aria-label="Close AI Assistant"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.timestamp.getTime()}`}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 shadow-md transition-all duration-200 hover:shadow-lg",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1 opacity-70",
                      message.role === "user"
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 shadow-md">
                  <div className="flex gap-1 items-center" aria-label="Assistant is typing">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            {pendingNavigation && !isLoading && (
              <Button
                size="sm"
                onClick={() => {
                  navigate(pendingNavigation);
                  setPendingNavigation(null);
                }}
                className="mt-1 w-full"
              >
                Go there now →
              </Button>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-background min-h-[40px] max-h-[96px] resize-none"
            />
            <Button
              size="icon"
              onClick={() => void sendMessage()}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </Card>
    </>
  );
};
