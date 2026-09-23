import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, MessageCircle, Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Help() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  const { data: guideData, isLoading: guideLoading } = useQuery<{ content: string }>({
    queryKey: ["/api/help/guide"],
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      return apiRequest("POST", "/api/help/chat", { 
        message, 
        conversationHistory 
      });
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim() || chatMutation.isPending) return;

    const userMessage = inputMessage.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInputMessage("");
    chatMutation.mutate(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help & Documentation</h1>
        <p className="text-gray-600">
          Learn how to use keylocate or ask the AI assistant for help
        </p>
      </div>

      <Tabs defaultValue="guide" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Employee Guide
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Employee Guide</CardTitle>
              <CardDescription>
                Comprehensive documentation covering all features of keylocate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {guideLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : guideData?.content ? (
                <ScrollArea className="h-[calc(100vh-280px)] w-full rounded-md border p-6 bg-white">
                  <div className="prose prose-sm max-w-none
                    prose-headings:text-gray-900 prose-headings:font-bold
                    prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-8 prose-h1:pb-3 prose-h1:border-b prose-h1:border-gray-200
                    prose-h2:text-xl prose-h2:mb-4 prose-h2:mt-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-100
                    prose-h3:text-lg prose-h3:mb-3 prose-h3:mt-5
                    prose-h4:text-base prose-h4:mb-2 prose-h4:mt-4
                    prose-p:text-gray-700 prose-p:mb-4 prose-p:leading-relaxed
                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-gray-800 prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg prose-pre:p-4
                    prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                    prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
                    prose-li:text-gray-700 prose-li:mb-1
                    prose-table:border-collapse prose-table:w-full prose-table:my-6
                    prose-thead:bg-gray-50 prose-thead:border-b-2 prose-thead:border-gray-200
                    prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-gray-900
                    prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-gray-100 prose-td:text-gray-700
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                    prose-hr:my-8 prose-hr:border-gray-200">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, children, ...props}) => {
                          const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                          return <h1 id={id} {...props}>{children}</h1>;
                        },
                        h2: ({node, children, ...props}) => {
                          const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                          return <h2 id={id} {...props}>{children}</h2>;
                        },
                        h3: ({node, children, ...props}) => {
                          const id = String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                          return <h3 id={id} {...props}>{children}</h3>;
                        },
                        a: ({node, href, children, ...props}) => {
                          if (href?.startsWith('#')) {
                            return (
                              <a 
                                href={href} 
                                onClick={(e) => {
                                  e.preventDefault();
                                  const element = document.getElementById(href.substring(1));
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                }}
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          }
                          return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                        }
                      }}
                    >
                      {guideData.content}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <p>No documentation available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>AI Assistant</CardTitle>
                <CardDescription>
                  Ask me anything about how to use keylocate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-420px)] mb-4 rounded-md border p-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-12">
                      <MessageCircle className="h-12 w-12 mb-4 text-gray-400" />
                      <p className="text-lg font-medium mb-2">Start a conversation</p>
                      <p className="text-sm">
                        Ask me how to issue keys, conduct audits, or any other keylocate question
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              message.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      ))}
                      {chatMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    placeholder="Ask a question... (e.g., How do I issue a key?)"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={chatMutation.isPending}
                    data-testid="input-help-chat"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || chatMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Example Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "How do I issue a key?",
                  "What should I do if a key is missing during an audit?",
                  "How do I add a new location?",
                  "What are the different user roles?",
                  "How do I use NFC tags?",
                  "How do I conduct a location audit?",
                  "What happens when I delete a key?",
                  "How do I move keys between locations?",
                ].map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => {
                      setInputMessage(question);
                    }}
                    data-testid={`button-example-${index}`}
                  >
                    <span className="text-xs line-clamp-2">{question}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
