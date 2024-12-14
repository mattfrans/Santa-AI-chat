import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, Volume2, VolumeX } from 'lucide-react';
import type { Chat } from '@db/schema';

// Define the SpeechRecognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal?: boolean;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: 'network' | 'not-allowed' | 'no-speech' | 'aborted' | 'audio-capture' | 'service-not-allowed';
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

export default function ChatWindow() {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<SpeechRecognition | null>(null);

  // Define mutation before using it in useEffect
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
    onSuccess: (response: Chat) => {
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
        recognition.current.continuous = false;
        recognition.current.interimResults = true;
        recognition.current.lang = 'en-US';

        recognition.current.onstart = () => {
          if (!mounted) return;
          setIsListening(true);
        };

        recognition.current.onend = () => {
          if (!mounted) return;
          setIsListening(false);
        };

        recognition.current.onresult = (event: SpeechRecognitionEvent) => {
          if (!mounted) return;
          
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          
          setMessage(transcript);
          
          // Update the input field with the transcript
          if (event.results[0].isFinal && transcript.trim()) {
            console.log('Final transcript:', transcript);
            setMessage(transcript);
          }
        };

        recognition.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (!mounted) return;
          
          console.error('Speech recognition error:', event.error);
          setIsListening(false);

          let errorMessage = 'There was a problem with the voice input.';
          let shouldShowError = true;
          
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
              shouldShowError = false; // Don't show error for user-initiated stops
              break;
            case 'audio-capture':
              errorMessage = 'No microphone was found. Please check your microphone settings.';
              break;
            case 'service-not-allowed':
              errorMessage = 'Speech recognition service is not allowed. Please try a different browser.';
              break;
            default:
              errorMessage = `Voice input error: ${event.error}. Please try again.`;
          }

          if (shouldShowError) {
            toast({
              variant: 'destructive',
              title: 'Voice Input Error',
              description: errorMessage,
              duration: 5000, // Show for 5 seconds
            });
          }
          
          // Reset the UI state
          setMessage('');
          recognition.current?.abort();
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
  }, [mutation, toast]);

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ['/api/chats'],
    queryFn: async () => {
      const res = await fetch('/api/chats', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch chats');
      return res.json();
    },
    refetchInterval: false,
    staleTime: 0,
    gcTime: 0,
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

  const stopListening = () => {
    try {
      if (recognition.current) {
        // First, remove all event listeners
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.onstart = null;
        
        // Stop both ways to ensure it's really stopped
        recognition.current.abort();
        recognition.current.stop();
        
        // Reset the recognition instance
        recognition.current = null;
        
        // Update UI state
        setIsListening(false);
        
        // Only clear message if it's empty/whitespace
        if (!message.trim()) {
          setMessage('');
        }
        
        // Cancel any ongoing speech synthesis
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        
        // Reinitialize recognition for next use
        initializeSpeechRecognition();
        
        console.log('Speech recognition stopped successfully');
      }
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      // Force reset all states
      setIsListening(false);
      recognition.current = null;
      initializeSpeechRecognition();
    }
  };

  const checkBrowserSupport = () => {
    const hasWebkitSpeech = 'webkitSpeechRecognition' in window;
    const hasSpeechRecognition = 'SpeechRecognition' in window;
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    
    if (!hasWebkitSpeech && !hasSpeechRecognition) {
      toast({
        title: "Browser Not Supported",
        description: "Voice features are not supported in your browser. Please try Chrome, Edge, or Safari.",
        variant: "destructive",
        duration: 5000,
      });
      return false;
    }
    
    if (!hasSpeechSynthesis) {
      toast({
        title: "Text-to-Speech Not Available",
        description: "Your browser doesn't support text-to-speech. Santa's voice responses will be disabled.",
        variant: "destructive",
        duration: 5000,
      });
    }
    
    return true;
  };

  const initializeSpeechRecognition = () => {
    try {
      // Check for browser support
      if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
        throw new Error('Speech recognition not supported in this browser');
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      
      // Configure recognition settings
      recognition.current.continuous = false;
      recognition.current.interimResults = true;
      recognition.current.lang = 'en-US';

      recognition.current.onstart = () => {
        setIsListening(true);
        console.log('Speech recognition started');
      };

      recognition.current.onend = () => {
        setIsListening(false);
        console.log('Speech recognition ended');
      };

      recognition.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        setMessage(transcript);
        
        // Only update the input field with the transcript, don't auto-submit
        if (event.results[0].isFinal && transcript.trim()) {
          console.log('Final transcript:', transcript);
        }
      };

      recognition.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        stopListening();
        
        let errorMessage = 'There was a problem with the voice input.';
        switch (event.error) {
          case 'network':
            errorMessage = 'Network error occurred. Please check your connection.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow access and try again.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone found. Please check your settings.';
            break;
          default:
            errorMessage = `Voice input error: ${event.error}. Please try again.`;
        }
        
        toast({
          variant: 'destructive',
          title: 'Voice Input Error',
          description: errorMessage,
          duration: 5000,
        });
      };

    } catch (error) {
      console.error('Speech recognition initialization error:', error);
      toast({
        variant: 'destructive',
        title: 'Voice Input Not Available',
        description: 'Speech recognition is not supported in your browser.',
      });
    }
  };

  const toggleListening = async () => {
    try {
      if (!checkBrowserSupport()) return;
      
      if (isListening) {
        if (recognition.current) {
          recognition.current.stop();
          setIsListening(false);
          
          // If we have a message from browser's speech recognition, ensure it's sent
          if (message.trim()) {
            // Show processing message
            toast({
              title: "Voice Input Stopped",
              description: "Processing your message...",
              duration: 2000,
            });
            
            // Send the message to Santa
            mutation.mutate(message);
            
            // Clear the message input after sending
            setMessage('');
          }
        }
        return;
      }

      // Clear previous message when starting new recording
      setMessage('');
      
      try {
        // Request microphone permission explicitly
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Ensure we have a fresh recognition instance
        if (!recognition.current) {
          initializeSpeechRecognition();
        }
        
        // Start recognition
        recognition.current?.start();
        setIsListening(true);
        
        toast({
          title: "Voice Input Started",
          description: "Listening for your message to Santa... Click the microphone button again to stop.",
          duration: 3000,
        });
        
        // Scroll to bottom to show the listening indicator
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } catch (error) {
        console.error('Microphone access error:', error);
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to use voice input.",
          variant: "destructive",
          duration: 5000,
        });
        setIsListening(false);
      }
    } catch (error) {
      console.error('Error toggling speech recognition:', error);
      setIsListening(false);
      toast({
        title: "Voice Input Error",
        description: "There was an error with the voice input. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Clean up function for speech recognition
  useEffect(() => {
    return () => {
      if (recognition.current) {
        recognition.current.abort();
        setIsListening(false);
      }
    };
  }, []);

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
          <motion.div
            animate={isListening ? {
              scale: [1, 1.1, 1],
              boxShadow: [
                "0 0 0 0 rgba(34, 197, 94, 0)",
                "0 0 0 10px rgba(34, 197, 94, 0.1)",
                "0 0 0 0 rgba(34, 197, 94, 0)"
              ]
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Button
              type="button"
              onClick={toggleListening}
              variant={isListening ? "destructive" : "secondary"}
              className={`${
                isListening 
                  ? 'bg-green-500 hover:bg-green-600 ring-2 ring-green-300 animate-pulse text-white' 
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              } transition-all duration-300 relative focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isListening ? 'focus:ring-green-500' : 'focus:ring-gray-500'
              } !important`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              <Mic className={`h-4 w-4 ${isListening ? 'text-white' : 'text-slate-100'}`} />
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </Button>
          </motion.div>
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
                animate={{ 
                  opacity: [0.5, 1, 0.5],
                  scale: [0.98, 1, 0.98]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5
                }}
                className="text-sm text-green-600 text-center p-2 bg-green-50 rounded-md border border-green-200"
              >
                🎙️ Listening to your message for Santa...
                <br />
                <span className="text-xs">
                  (Click the microphone button again to stop)
                </span>
              </motion.div>
            )}
      </form>
    </Card>
  );
}