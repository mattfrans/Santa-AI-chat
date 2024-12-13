import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Chat } from '@db/schema';

export default function ChatWindow() {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ['/api/chats'],
    onSuccess: () => {
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
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

      <ScrollArea className="flex-1 p-4 relative" ref={scrollRef}>
        <div className="space-y-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {chats.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ 
                  type: "spring",
                  stiffness: 500,
                  damping: 40,
                  mass: 1
                }}
                className={`flex ${
                  chat.isFromSanta ? 'justify-start' : 'justify-end'
                }`}
              >
                <motion.div
                  whileHover={{ scale: 1.02, rotate: [-0.5, 0.5] }}
                  transition={{
                    rotate: {
                      repeat: Infinity,
                      repeatType: "reverse",
                      duration: 0.3
                    }
                  }}
                  className={`max-w-[80%] p-3 rounded-lg shadow-lg backdrop-blur-sm ${
                    chat.isFromSanta
                      ? 'bg-red-100/90 text-red-900 hover:bg-red-50/95 border border-red-200'
                      : 'bg-green-100/90 text-green-900 hover:bg-green-50/95 border border-green-200'
                  }`}
                >
                  <div className="relative">
                    {chat.message}
                    {chat.isFromSanta && chat.tone && (
                      <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="block mt-1 text-xs text-red-600/70 italic"
                      >
                        {chat.tone === 'jolly' && '🎅 Ho ho ho!'}
                        {chat.tone === 'caring' && '💝 With love from Santa'}
                        {chat.tone === 'encouraging' && '⭐ Keep being good!'}
                        {chat.tone === 'playful' && '🎮 Time for fun!'}
                        {chat.tone === 'wise' && '📚 Santa knows best'}
                        {chat.tone === 'merry' && '🎄 Merry Christmas!'}
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <motion.div className="flex-1"
            initial={false}
            animate={{ scale: message ? 1.02 : 1 }}
            transition={{ duration: 0.2 }}>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message to Santa..."
              className="flex-1 border-red-200 focus:border-red-300 transition-colors"
            />
          </motion.div>
          <Button
            type="submit"
            className="bg-red-700 hover:bg-red-800 transition-all duration-200"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <div className="flex items-center space-x-1">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ 
                    rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                    scale: { duration: 1, repeat: Infinity }
                  }}
                  className="text-red-600"
                >
                  <Loader2 className="h-4 w-4" />
                </motion.div>
                <span className="text-sm">Sending to North Pole...</span>
              </div>
            ) : (
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-1"
              >
                <span>Send to Santa</span>
                <span className="text-lg">🎅</span>
              </motion.span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
