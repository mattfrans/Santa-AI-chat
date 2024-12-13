import { useState, useEffect, useRef } from 'react';
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, Volume2, VolumeX } from 'lucide-react';
import type { Chat } from '@db/schema';

export default function ChatWindow() {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeSpeechRecognition = () => {
      if (!mounted) return;

      try {
        // Check for browser support
        if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
          throw new Error('Speech recognition not supported in this browser');
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition.current = new SpeechRecognition();
        
        // Configure recognition settings
        recognition.current.continuous = false; // Changed to false to prevent network issues
        recognition.current.interimResults = true;
        recognition.current.lang = 'en-US'; // Set language explicitly

        recognition.current.onstart = () => {
          if (!mounted) return;
          setIsListening(true);
        };

        recognition.current.onend = () => {
          if (!mounted) return;
          setIsListening(false);
        };

        recognition.current.onresult = (event) => {
          if (!mounted) return;
          
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
          
          setMessage(transcript);
          
          // Auto-submit if we have a final result
          if (event.results[0].isFinal && transcript.trim()) {
            recognition.current?.stop();
            mutation.mutate(transcript);
          }
        };

        recognition.current.onerror = (event) => {
          if (!mounted) return;
          
          console.error('Speech recognition error:', event.error);
          setIsListening(false);

          let errorMessage = 'There was a problem with the voice input.';
          
          switch (event.error) {
            case 'network':
              errorMessage = 'Network error occurred. Please check your internet connection.';
              break;
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
              break;
            case 'no-speech':
              errorMessage = 'No speech was detected. Please try again.';
              break;
            case 'aborted':
              return; // Don't show error for user-initiated stops
          }

          toast({
            variant: 'destructive',
            title: 'Voice Input Error',
            description: errorMessage,
          });
        };

      } catch (error) {
        console.error('Speech recognition initialization error:', error);
        toast({
          variant: 'destructive',
          title: 'Voice Input Not Available',
          description: 'Speech recognition is not supported in your browser. Please type your message instead.',
        });
      }
    };

    initializeSpeechRecognition();

    return () => {
      mounted = false;
      if (recognition.current) {
        recognition.current.stop();
        recognition.current = null;
      }
    };
  }, [mutation, toast]); // Added dependencies

  const { data: chats = [] } = useQuery({
    queryKey: ['/api/chats'],
    queryFn: async () => {
      const res = await fetch('/api/chats', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch chats');
      return res.json() as Promise<Chat[]>;
    },
    refetchInterval: false,
    onSuccess: (data) => {
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
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      setMessage('');
      
      // Auto-speak Santa's response if enabled
      if (autoSpeak && response.isFromSanta) {
        speakText(response.message);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const speakText = async (text: string) => {
    if (!window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for Santa's voice
    utterance.pitch = 0.9; // Slightly lower pitch for Santa
    
    // Find a deeper voice if available
    const voices = window.speechSynthesis.getVoices();
    const deeperVoice = voices.find(voice => voice.name.includes('Male'));
    if (deeperVoice) utterance.voice = deeperVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = async () => {
    try {
      if (!recognition.current) {
        toast({
          title: "Voice Input Not Available",
          description: "Your browser doesn't support voice input.",
          variant: "destructive",
        });
        return;
      }

      if (isListening) {
        recognition.current.stop();
      } else {
        // Clear previous message when starting new recording
        setMessage('');
        
        try {
          // Request microphone permission explicitly
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Clean up
          
          // Start recognition
          recognition.current.start();
        } catch (error) {
          toast({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use voice input.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error toggling speech recognition:', error);
      toast({
        title: "Voice Input Error",
        description: "There was an error with the voice input. Please try again.",
        variant: "destructive",
      });
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      if (isListening) {
        recognition.current?.stop();
        setIsListening(false);
      }
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
                  <div 
                    className="relative cursor-pointer group" 
                    onClick={() => chat.isFromSanta && speakText(chat.message)}
                    title={chat.isFromSanta ? "Click to hear Santa speak!" : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {chat.message}
                      {chat.isFromSanta && (
                        <Volume2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
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

      <form onSubmit={handleSubmit} className="p-4 border-t space-y-2">
        <div className="flex gap-2">
          <motion.div className="flex-1"
            initial={false}
            animate={{ scale: message ? 1.02 : 1 }}
            transition={{ duration: 0.2 }}>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type or speak your message to Santa..."}
              className={`flex-1 border-red-200 focus:border-red-300 transition-colors ${
                isListening ? 'bg-green-50' : ''
              }`}
            />
          </motion.div>
          <Button
            type="button"
            onClick={toggleListening}
            className={`${
              isListening 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } transition-all duration-200`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
          </Button>
          <Button
            type="button"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`${
              autoSpeak 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } transition-all duration-200`}
            title={autoSpeak ? 'Turn off auto-speak' : 'Turn on auto-speak'}
          >
            {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
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
        {isListening && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-green-600 text-center"
          >
            Listening... Click the microphone or speak your message to Santa
          </motion.div>
        )}
      </form>
    </Card>
  );
}
