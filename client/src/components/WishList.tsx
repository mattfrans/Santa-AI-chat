import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { WishlistItem } from '@db/schema';

const categories = [
  'Toys',
  'Books',
  'Electronics',
  'Clothes',
  'Sports',
  'Other'
];

export default function WishList() {
  const [newItem, setNewItem] = useState('');
  const [category, setCategory] = useState('Toys');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: wishlist = [] } = useQuery<WishlistItem[]>({
    queryKey: ['/api/wishlist'],
  });

  const mutation = useMutation({
    mutationFn: async (data: { item: string; category: string }) => {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wishlist'] });
      setNewItem('');
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
    if (newItem.trim()) {
      mutation.mutate({ item: newItem, category });
    }
  };

  return (
    <Card className="p-6 bg-white/95">
      <h2 className="text-2xl font-bold text-red-700 mb-4">My Wishlist</h2>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a wish..."
            className="flex-1"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            className="bg-green-700 hover:bg-green-800"
            disabled={mutation.isPending}
          >
            Add
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        {categories.map((cat) => {
          const items = wishlist.filter((item) => item.category === cat);
          if (items.length === 0) return null;

          return (
            <div key={cat} className="space-y-2">
              <h3 className="font-semibold text-lg text-gray-700">{cat}</h3>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
                >
                  <span>{item.item}</span>
                  {item.notes && (
                    <span className="text-sm text-gray-500">{item.notes}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
