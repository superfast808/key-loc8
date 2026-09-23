import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, LogOut, MapPin, ArrowLeft, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PORTAL_TOKEN_KEY = "customer_portal_token";

function useCustomerAuth() {
  const token = typeof window !== "undefined" ? localStorage.getItem(PORTAL_TOKEN_KEY) : null;
  return token;
}

// ── Login Page ────────────────────────────────────────────────────────────────
export function CustomerPortalLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    if (token) navigate("/customer-portal/dashboard");
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer-portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Login failed"); return; }
      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      navigate("/customer-portal/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <KeyRound className="h-10 w-10 mx-auto text-blue-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to view and update your assignment instructions</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  className="mt-1"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  className="mt-1"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Invite Setup Page ─────────────────────────────────────────────────────────
export function CustomerPortalInvite() {
  const [match, params] = useRoute("/customer-portal/invite/:token");
  const token = params?.token ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`/api/customer-portal/invite/${token}`)
      .then(async r => {
        if (!r.ok) { setError("This invite link is invalid or has expired."); setChecking(false); return; }
        const data = await r.json();
        setCustomerInfo(data);
        setName(data.name ?? "");
        setChecking(false);
      })
      .catch(() => { setError("Failed to load invite."); setChecking(false); });
  }, [token]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/customer-portal/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Setup failed"); setLoading(false); return; }
      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      toast({ title: "Account activated! Welcome." });
      navigate("/customer-portal/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center text-gray-400">Checking invite…</div>;

  if (!customerInfo) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 text-center">
          <p className="text-red-500 text-sm">{error || "Invalid invite link."}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <KeyRound className="h-10 w-10 mx-auto text-blue-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Activate Your Account</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your customer portal password</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <Label>Your Name (optional)</Label>
                <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" value={customerInfo.email} disabled />
              </div>
              <div>
                <Label>Password *</Label>
                <Input type="password" className="mt-1" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" required />
              </div>
              <div>
                <Label>Confirm Password *</Label>
                <Input type="password" className="mt-1" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Activating…" : "Activate Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Dashboard (location list) ─────────────────────────────────────────────────
export function CustomerPortalDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = localStorage.getItem(PORTAL_TOKEN_KEY);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    if (!token) { navigate("/customer-portal"); return; }
    Promise.all([
      fetch("/api/customer-portal/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/customer-portal/locations", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([me, locs]) => {
      if (me.message) { localStorage.removeItem(PORTAL_TOKEN_KEY); navigate("/customer-portal"); return; }
      setCustomerName(me.name || me.email);
      setLocations(Array.isArray(locs) ? locs : []);
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem(PORTAL_TOKEN_KEY);
      navigate("/customer-portal");
    });
  }, [token, navigate]);

  async function logout() {
    await fetch("/api/customer-portal/logout", { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    navigate("/customer-portal");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Customer Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:inline">{customerName}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" />Logout
          </Button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Your Locations</h2>
        {loading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />)}</div>}
        {!loading && locations.length === 0 && (
          <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
            <MapPin className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm">No locations have been assigned to your account yet.</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((loc: any) => (
            <Card key={loc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/customer-portal/location/${loc.id}`)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: loc.color || "#6b7280" }} />
                  <div>
                    <p className="font-medium text-gray-900">{loc.name}</p>
                    <p className="text-xs text-gray-500">{loc.type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Location Assignment Editor (customer view) ────────────────────────────────
export function CustomerPortalLocation() {
  const [match, params] = useRoute("/customer-portal/location/:locationId");
  const locationId = parseInt(params?.locationId ?? "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = localStorage.getItem(PORTAL_TOKEN_KEY);

  const [assignmentData, setAssignmentData] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationName, setLocationName] = useState("");

  useEffect(() => {
    if (!token) { navigate("/customer-portal"); return; }
    fetch(`/api/customer-portal/location/${locationId}/assignment`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async r => {
      if (!r.ok) {
        const d = await r.json();
        if (r.status === 401) { localStorage.removeItem(PORTAL_TOKEN_KEY); navigate("/customer-portal"); return; }
        if (r.status === 403) { navigate("/customer-portal/dashboard"); return; }
        return;
      }
      const data = await r.json();
      setAssignmentData(data);
      const init: Record<number, string> = {};
      data.sections.forEach((s: any) => {
        const val = data.values.find((v: any) => v.sectionId === s.id);
        init[s.id] = val?.value ?? "";
      });
      setFormValues(init);
      setLoading(false);
    });
    // Also get location name from dashboard list
    fetch("/api/customer-portal/locations", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then((locs: any[]) => {
        const loc = Array.isArray(locs) ? locs.find(l => l.id === locationId) : null;
        if (loc) setLocationName(loc.name);
      });
  }, [token, locationId, navigate]);

  function handleChange(sectionId: number, value: string) {
    setFormValues(prev => ({ ...prev, [sectionId]: value }));
    setIsDirty(true);
  }

  async function handleSave() {
    if (!assignmentData || !token) return;
    setSaving(true);
    const values = assignmentData.sections.map((s: any) => ({
      sectionId: s.id,
      value: formValues[s.id] ?? null,
    }));
    const changes = assignmentData.sections
      .map((s: any) => {
        const oldVal = (assignmentData.values.find((v: any) => v.sectionId === s.id)?.value) ?? "";
        const newVal = formValues[s.id] ?? "";
        if (oldVal !== newVal) return { sectionLabel: s.label, oldValue: oldVal, newValue: newVal };
        return null;
      })
      .filter(Boolean);
    try {
      const res = await fetch(`/api/customer-portal/location/${locationId}/assignment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ values, changes }),
      });
      if (res.ok) {
        toast({ title: "Saved", description: "Your changes have been saved." });
        setIsDirty(false);
        // Update local state
        setAssignmentData((prev: any) => ({
          ...prev,
          values: values.map((v: any) => ({ sectionId: v.sectionId, value: v.value })),
        }));
      } else {
        toast({ title: "Error saving", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/customer-portal/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <KeyRound className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900 truncate">{locationName || "Location"}</span>
        </div>
        <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Assignment Instructions</h2>
        {assignmentData?.sections?.length === 0 && (
          <p className="text-gray-400 text-sm">No sections defined yet.</p>
        )}
        <div className="space-y-6">
          {assignmentData?.sections?.map((section: any) => (
            <div key={section.id}>
              {section.type === "divider" && <hr className="border-gray-200" />}
              {section.type === "heading" && (
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-1">{section.label}</h3>
              )}
              {section.type === "text_input" && (
                <div>
                  <Label>{section.label}{section.required && <span className="text-red-500 ml-1">*</span>}</Label>
                  <Input className="mt-1" value={formValues[section.id] ?? ""} onChange={e => handleChange(section.id, e.target.value)} />
                </div>
              )}
              {section.type === "textarea" && (
                <div>
                  <Label>{section.label}{section.required && <span className="text-red-500 ml-1">*</span>}</Label>
                  <Textarea className="mt-1 min-h-[100px] resize-y" value={formValues[section.id] ?? ""} onChange={e => handleChange(section.id, e.target.value)} />
                </div>
              )}
              {section.type === "dropdown" && section.options && (
                <div>
                  <Label>{section.label}{section.required && <span className="text-red-500 ml-1">*</span>}</Label>
                  <Select value={formValues[section.id] ?? ""} onValueChange={v => handleChange(section.id, v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select an option" /></SelectTrigger>
                    <SelectContent>
                      {section.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {section.type === "image" && (
                <div>
                  <Label>{section.label}{section.required && <span className="text-red-500 ml-1">*</span>}</Label>
                  <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center">
                    {formValues[section.id] ? (
                      <div>
                        <img src={formValues[section.id]} alt={section.label} className="max-h-40 mx-auto rounded mb-2" />
                        <Button variant="ghost" size="sm" onClick={() => handleChange(section.id, "")}>Remove</Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <span className="text-sm text-blue-600">Click to upload image</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => handleChange(section.id, ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {assignmentData?.sections?.length > 0 && (
            <div className="flex justify-end pt-4">
              <Button size="lg" onClick={handleSave} disabled={!isDirty || saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
