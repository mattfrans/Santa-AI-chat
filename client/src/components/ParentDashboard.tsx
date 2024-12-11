import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { User, Chat, WishlistItem } from '@db/schema';

export default function ParentDashboard() {
  const { data: children = [] } = useQuery<User[]>({
    queryKey: ['/api/children'],
  });

  return (
    <Card className="p-6 bg-white/95">
      <h2 className="text-2xl font-bold text-red-700 mb-4">Parent Dashboard</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {children.map((child) => (
          <Card key={child.id} className="p-4">
            <h3 className="text-xl font-semibold mb-4">{child.username}'s Activity</h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Recent Chats</h4>
                <ScrollArea className="h-40 rounded-md border p-2">
                  {child.chats?.map((chat: Chat) => (
                    <div
                      key={chat.id}
                      className={`mb-2 p-2 rounded ${
                        chat.isFromSanta
                          ? 'bg-red-50 text-red-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {chat.message}
                    </div>
                  ))}
                </ScrollArea>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Wishlist</h4>
                <ScrollArea className="h-40 rounded-md border p-2">
                  {child.wishlistItems?.map((item: WishlistItem) => (
                    <div
                      key={item.id}
                      className="mb-2 p-2 bg-gray-50 rounded flex justify-between"
                    >
                      <span>{item.item}</span>
                      <span className="text-sm text-gray-500">
                        {item.category}
                      </span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
