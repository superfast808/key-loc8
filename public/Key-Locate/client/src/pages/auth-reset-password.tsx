import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const AuthResetPassword = () => {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string>("");
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string>("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);

    if (!t) {
      setTokenValid(false);
      setTokenError("This reset link is missing a token. Please request a new one.");
      setValidating(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(t)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError(data.message || "This reset link is invalid or has expired.");
        }
      } catch {
        setTokenValid(false);
        setTokenError("Could not validate the reset link. Please try again.");
      } finally {
        setValidating(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose a New Password</h1>
          <p className="text-gray-600">Set the new password for your keylocate account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Use at least 8 characters. Make it something you can remember.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {validating && (
              <p className="text-sm text-gray-500 text-center">Validating reset link…</p>
            )}

            {!validating && !tokenValid && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{tokenError}</AlertDescription>
                </Alert>
                <Link href="/auth/forgot-password">
                  <Button className="w-full">Request a new reset link</Button>
                </Link>
              </>
            )}

            {!validating && tokenValid && success && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  Password reset! Redirecting you to sign in…
                </AlertDescription>
              </Alert>
            )}

            {!validating && tokenValid && !success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative mt-2">
                    <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pl-10"
                      disabled={submitting}
                      autoComplete="new-password"
                      data-testid="input-new-password"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative mt-2">
                    <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="pl-10"
                      disabled={submitting}
                      autoComplete="new-password"
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting || !password || !confirm}
                  data-testid="button-reset-password"
                >
                  {submitting ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}

            <div className="text-center pt-2">
              <Link href="/login">
                <Button variant="ghost" className="text-sm">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthResetPassword;
