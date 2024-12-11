import { useUser } from '@/hooks/use-user';
import ChatWindow from '@/components/ChatWindow';
import WishList from '@/components/WishList';
import ParentDashboard from '@/components/ParentDashboard';
import SnowAnimation from '@/components/SnowAnimation';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { user, logout } = useUser();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2C3E50] to-[#34495E] p-4">
      <SnowAnimation />
      
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            {user.isParent ? "Parent Dashboard" : "Santa's Workshop"}
          </h1>
          <Button
            onClick={() => logout()}
            variant="outline"
            className="text-white border-white hover:bg-white/20"
          >
            Logout
          </Button>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {user.isParent ? (
            <ParentDashboard />
          ) : (
            <>
              <ChatWindow />
              <WishList />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
