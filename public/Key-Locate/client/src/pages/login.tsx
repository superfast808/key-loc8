import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Key, User, ArrowLeft, Smartphone, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import keylocateLogo from "@assets/ChatGPT Image Oct 30, 2025, 10_58_13 AM_1761821897470.png";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [otp, setOtp] = useState("");
  const { toast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      setIsLoading(true);
      return apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (data: any) => {
      if (data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        toast({
          title: "Verification code sent",
          description: "A 6-digit code has been sent to your mobile number.",
        });
      } else {
        window.location.href = "/";
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
    onSettled: () => setIsLoading(false),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      return apiRequest("POST", "/api/auth/2fa/verify", { otp });
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired code",
        variant: "destructive",
      });
    },
    onSettled: () => setIsLoading(false),
  });

  const resendMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/2fa/resend", {}),
    onSuccess: () => {
      setOtp("");
      toast({ title: "Code resent", description: "A new verification code has been sent." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to resend code", variant: "destructive" });
    },
  });

  const onSubmit = (data: LoginFormData) => loginMutation.mutate(data);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-between items-start mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex justify-center flex-1">
              <img src={keylocateLogo} alt="keylocate" className="h-32 sm:h-40 w-auto" />
            </div>
            <div className="w-10"></div>
          </div>
          <CardDescription>
            Professional key management system for security teams
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Step 1: Email + password ── */}
          {!requiresTwoFactor && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="Enter your email"
                            className="pl-10"
                            disabled={isLoading}
                            autoComplete="off"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your password"
                            className="pl-10"
                            disabled={isLoading}
                            autoComplete="new-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>

                <div className="text-center">
                  <Link href="/auth/forgot-password">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-gray-600 hover:text-blue-600 p-0 h-auto"
                      data-testid="link-forgot-password"
                    >
                      Forgot your password?
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          )}

          {/* ── Step 2: OTP verification ── */}
          {requiresTwoFactor && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2 text-center py-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-blue-600" />
                </div>
                <p className="font-medium text-gray-900">Check your phone</p>
                <p className="text-sm text-gray-500">
                  We sent a 6-digit verification code to your registered mobile number.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Verification code</label>
                <Input
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                />
              </div>

              <Button
                className="w-full"
                disabled={otp.length !== 6 || isLoading}
                onClick={() => verifyMutation.mutate()}
              >
                {isLoading ? "Verifying..." : "Verify & Sign In"}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => { setRequiresTwoFactor(false); setOtp(""); }}
                >
                  ← Back to login
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  disabled={resendMutation.isPending}
                  onClick={() => resendMutation.mutate()}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                  {resendMutation.isPending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
