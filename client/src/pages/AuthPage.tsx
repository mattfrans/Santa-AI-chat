import { useState } from "react";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { Checkbox } from "@/components/ui/checkbox";

type FormData = {
  username: string;
  password: string;
  isParent?: boolean;
};

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { register, login, error } = useUser();
  const { toast } = useToast();
  const form = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      if (isLogin) {
        await login(data);
      } else {
        await register(data);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#2C3E50] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6 bg-white/95">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-red-700">Santa Chat</h1>
          <p className="text-gray-600">
            {isLogin ? "Welcome back!" : "Create your account"}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              {...form.register("username", { required: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...form.register("password", { required: true })}
            />
          </div>

          {!isLogin && (
            <div className="flex items-center space-x-2">
              <Checkbox id="isParent" {...form.register("isParent")} />
              <Label htmlFor="isParent">I am a parent</Label>
            </div>
          )}

          <Button type="submit" className="w-full bg-red-700 hover:bg-red-800">
            {isLogin ? "Login" : "Register"}
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => setIsLogin(!isLogin)}
            className="text-green-700"
          >
            {isLogin ? "Need an account?" : "Already have an account?"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
