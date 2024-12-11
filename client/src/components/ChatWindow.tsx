import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Chat } from '@db/schema';

export default function ChatWindow() {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ['/api/chats'],
  });

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      setMessage('');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      mutation.mutate(message);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] bg-white/95">
      <div className="p-4 bg-red-700 text-white rounded-t-lg">
        <h2 className="text-xl font-bold">Chat with Santa</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`flex ${
                chat.isFromSanta ? 'justify-start' : 'justify-end'
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  chat.isFromSanta
                    ? 'bg-red-100 text-red-900'
                    : 'bg-green-100 text-green-900'
                }`}
              >
                {chat.message}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message to Santa..."
            className="flex-1"
          />
          <Button
            type="submit"
            className="bg-red-700 hover:bg-red-800"
            disabled={mutation.isPending}
          >
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
