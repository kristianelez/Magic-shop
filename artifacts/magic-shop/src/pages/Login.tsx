import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Logo } from "@/components/Logo";
import { Loader2, LogIn } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const result = await apiRequest("POST", "/api/auth/login", credentials);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Uspješna prijava",
        description: "Dobrodošli u Magic Shop",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Greška pri prijavljivanju",
        description: error.message || "Neispravno korisničko ime ili šifra",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at 30% 20%, hsl(220 55% 20%) 0%, hsl(220 60% 10%) 55%, hsl(220 70% 5%) 100%)",
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={120} ring={false} className="shadow-2xl ring-4 ring-primary/40" />
          <div>
            <h1
              className="text-3xl font-semibold tracking-wide"
              style={{ color: "hsl(28 75% 65%)" }}
              data-testid="text-brand-title"
            >
              Magic Cosmetic Shop
            </h1>
            <p className="text-sm mt-1" style={{ color: "hsl(30 25% 80%)" }}>
              CRM za upravljanje prodajom
            </p>
          </div>
        </div>

        <Card
          className="w-full backdrop-blur-sm border-white/10"
          style={{ backgroundColor: "hsla(0, 0%, 100%, 0.04)" }}
        >
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  data-testid="label-username"
                  style={{ color: "hsl(30 25% 90%)" }}
                >
                  Korisničko ime
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Unesite korisničko ime"
                  required
                  data-testid="input-username"
                  autoComplete="username"
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  data-testid="label-password"
                  style={{ color: "hsl(30 25% 90%)" }}
                >
                  Šifra
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Unesite šifru"
                  required
                  data-testid="input-password"
                  autoComplete="current-password"
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-primary"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Prijavljivanje...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Prijavi se
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs" style={{ color: "hsl(30 15% 60%)" }}>
          © {new Date().getFullYear()} Magic Cosmetic Shop
        </p>
      </div>
    </div>
  );
}
