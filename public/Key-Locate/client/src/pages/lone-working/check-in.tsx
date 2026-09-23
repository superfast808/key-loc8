import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin, Briefcase, AlertCircle, Loader2, CheckCircle2, Lock,
  Calendar, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { format, isWithinInterval, subMinutes, addMinutes, isFuture, isPast, differenceInMinutes } from "date-fns";
import type { LwStatus, LwJob } from "@/hooks/useLoneWorking";
import { useAuth } from "@/hooks/useAuth";

interface LwShift {
  id: number;
  jobId: number;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  job?: { id: number; name: string; jobType: string; locationId: number | null; location?: { name: string } | null } | null;
}

function shiftSignOnStatus(shift: LwShift): "signable" | "upcoming" | "past" | "active" {
  const now = new Date();
  const start = new Date(shift.scheduledStart);
  const end = new Date(shift.scheduledEnd);
  if (shift.status === "active" || shift.status === "completed") return "active";
  if (isPast(end)) return "past";
  // Within 30 minutes before start, or shift has already started
  if (now >= subMinutes(start, 30) && now <= end) return "signable";
  return "upcoming";
}

function minutesUntilSignOn(shift: LwShift): number {
  const start = new Date(shift.scheduledStart);
  return Math.max(0, differenceInMinutes(subMinutes(start, 30), new Date()));
}

export default function LoneWorkingCheckIn() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [showPastShifts, setShowPastShifts] = useState(false);

  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  const { data: status, isLoading } = useQuery<LwStatus>({ queryKey: ["/api/lw/status"] });
  const { data: myShifts = [] } = useQuery<LwShift[]>({ queryKey: ["/api/lw/my-shifts"] });

  // Redirect if already checked in
  useEffect(() => {
    if (status?.activeCheckIn) {
      navigate("/lone-working/active");
    }
  }, [status?.activeCheckIn, navigate]);

  const requestGps = () => {
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => { setGpsError("GPS unavailable — you can still check in without it."); setGpsLoading(false); },
      { timeout: 10000 }
    );
  };

  const checkInMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lw/check-in", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lw/my-shifts"] });
      toast({ title: "Checked in", description: "You are now checked in. Stay safe!" });
      navigate("/lone-working/active");
    },
    onError: (e: any) => toast({ title: "Check-in failed", description: e.message, variant: "destructive" }),
  });

  const handleSignOnShift = (shift: LwShift) => {
    setSelectedShiftId(shift.id);
    setSelectedJobId(shift.jobId);
    checkInMutation.mutate({
      jobId: shift.jobId,
      shiftId: shift.id,
      lat: gps?.lat,
      lng: gps?.lng,
      notes: notes || undefined,
    });
  };

  const handleAdHocCheckIn = () => {
    if (!selectedJobId) return;
    checkInMutation.mutate({
      jobId: selectedJobId,
      lat: gps?.lat,
      lng: gps?.lng,
      notes: notes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const jobs = status?.jobs || [];

  // Categorise shifts
  const signableShifts = myShifts.filter(s => shiftSignOnStatus(s) === "signable");
  const upcomingShifts = myShifts.filter(s => shiftSignOnStatus(s) === "upcoming");
  const pastShifts = myShifts.filter(s => shiftSignOnStatus(s) === "past");
  const hasShifts = myShifts.length > 0;

  return (
    <div className="min-h-screen bg-background flex items-start justify-center pt-8 px-4">
      <div className="w-full max-w-lg space-y-5 pb-12">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Lock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Lone Working Check-In</h1>
          <p className="text-muted-foreground text-sm">
            Sign on to a scheduled shift or check in ad-hoc.
          </p>
        </div>

        {/* GPS capture — available for any check-in */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                GPS Location
              </div>
              {!gps && (
                <Button variant="outline" size="sm" onClick={requestGps} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5 mr-1.5" />}
                  {gpsLoading ? "Getting…" : "Share location"}
                </Button>
              )}
              {gps && (
                <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </span>
              )}
            </div>
            {gpsError && <p className="text-xs text-muted-foreground">{gpsError}</p>}
          </CardContent>
        </Card>

        {/* ── Scheduled Shifts ────────────────────────────────────── */}
        {hasShifts && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Your Shifts
            </h2>

            {/* Signable now */}
            {signableShifts.map(shift => (
              <Card key={shift.id} className="border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">Sign on now</Badge>
                        <span className="font-medium text-sm">{shift.job?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(shift.scheduledStart), "EEE dd MMM, HH:mm")} – {format(new Date(shift.scheduledEnd), "HH:mm")}
                      </p>
                      {shift.job?.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{shift.job.location.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleSignOnShift(shift)}
                    disabled={checkInMutation.isPending}
                  >
                    {checkInMutation.isPending && selectedShiftId === shift.id
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing on…</>
                      : <><CheckCircle2 className="w-4 h-4 mr-2" />Sign On to Shift</>
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}

            {/* Upcoming shifts */}
            {upcomingShifts.map(shift => {
              const minsUntil = minutesUntilSignOn(shift);
              const hoursUntil = Math.floor(minsUntil / 60);
              const remainingMins = minsUntil % 60;
              const timeUntil = hoursUntil > 0
                ? `${hoursUntil}h ${remainingMins}m until sign-on opens`
                : `${remainingMins}m until sign-on opens`;
              return (
                <Card key={shift.id} className="opacity-80">
                  <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{
                          differenceInMinutes(new Date(shift.scheduledStart), new Date()) < 60 * 24
                            ? "Today" : format(new Date(shift.scheduledStart), "EEE dd MMM")
                        }</Badge>
                        <span className="font-medium text-sm">{shift.job?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(shift.scheduledStart), "EEE dd MMM, HH:mm")} – {format(new Date(shift.scheduledEnd), "HH:mm")}
                      </p>
                      {shift.job?.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{shift.job.location.name}
                        </p>
                      )}
                      <p className="text-xs text-blue-600 dark:text-blue-400">{timeUntil}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">Scheduled</Badge>
                  </CardContent>
                </Card>
              );
            })}

            {/* Past shifts toggle */}
            {pastShifts.length > 0 && (
              <button
                onClick={() => setShowPastShifts(v => !v)}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
              >
                {showPastShifts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showPastShifts ? "Hide" : "Show"} {pastShifts.length} past shift{pastShifts.length > 1 ? "s" : ""}
              </button>
            )}
            {showPastShifts && pastShifts.map(shift => (
              <Card key={shift.id} className="opacity-50">
                <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{shift.job?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(shift.scheduledStart), "EEE dd MMM, HH:mm")} – {format(new Date(shift.scheduledEnd), "HH:mm")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{shift.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Ad-hoc check-in ─────────────────────────────────────── */}
        {jobs.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowAdHoc(v => !v)}
              className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground w-full text-left"
            >
              <Briefcase className="w-4 h-4" />
              {showAdHoc ? "Hide" : "Check in without a scheduled shift"}
              {showAdHoc ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
            </button>

            {showAdHoc && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Select location (ad-hoc)</CardTitle>
                  <CardDescription>Check in outside of your scheduled shifts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {jobs.map((job: LwJob) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedJobId === job.id && !selectedShiftId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{job.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">{job.jobType}</Badge>
                        {selectedJobId === job.id && !selectedShiftId && (
                          <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                      {job.location && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{job.location.name}
                        </p>
                      )}
                    </button>
                  ))}
                  <Button
                    className="w-full"
                    disabled={!selectedJobId || checkInMutation.isPending}
                    onClick={handleAdHocCheckIn}
                  >
                    {checkInMutation.isPending && !selectedShiftId
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking in…</>
                      : <><CheckCircle2 className="w-4 h-4 mr-2" />Check In (Ad-hoc)</>
                    }
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* No jobs and no shifts warning */}
        {jobs.length === 0 && !hasShifts && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">No shifts or locations available</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  You have no upcoming shifts. Please contact your manager.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Anything to note about today's shift…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Admin shortcut */}
        {isAdmin && (
          <p className="text-center text-xs text-muted-foreground pb-2">
            <button onClick={() => navigate("/lone-working")} className="underline hover:text-foreground">
              Back to admin panel
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
