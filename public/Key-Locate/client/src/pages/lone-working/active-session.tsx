import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Clock, MapPin, Briefcase, LogOut, Loader2, CheckCircle2, Key } from "lucide-react";
import type { LwStatus } from "@/hooks/useLoneWorking";

function formatDuration(startTime: string) {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const secs = Math.floor((now - start) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LoneWorkingActiveSession() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState("");
  const [checkOutNotes, setCheckOutNotes] = useState("");

  const { data: status, isLoading } = useQuery<LwStatus>({ queryKey: ["/api/lw/status"] });
  const { data: jobs } = useQuery<any[]>({ queryKey: ["/api/lw/jobs"] });

  // Redirect if no active check-in
  useEffect(() => {
    if (!isLoading && !status?.activeCheckIn) {
      navigate("/lone-working/check-in");
    }
  }, [status?.activeCheckIn, isLoading, navigate]);

  // Tick timer
  useEffect(() => {
    if (!status?.activeCheckIn) return;
    const timer = setInterval(() => {
      setElapsed(formatDuration(status.activeCheckIn!.checkInTime));
    }, 1000);
    setElapsed(formatDuration(status.activeCheckIn.checkInTime));
    return () => clearInterval(timer);
  }, [status?.activeCheckIn?.checkInTime]);

  const checkOutMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lw/check-out", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/status"] });
      toast({ title: "Checked out", description: "Your session has ended. Thank you!" });
      navigate("/lone-working/check-in");
    },
    onError: (e: any) => {
      toast({ title: "Check-out failed", description: e.message, variant: "destructive" });
    },
  });

  const handleCheckOut = () => {
    checkOutMutation.mutate({ notes: checkOutNotes || undefined });
  };

  if (isLoading || !status?.activeCheckIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { activeCheckIn, assignments } = status;
  const currentAssignment = assignments.find(a => a.jobId === activeCheckIn.jobId);
  const job = currentAssignment?.job;
  const isMobile = job?.jobType === "mobile";

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Status banner */}
        <Card className="border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">You're checked in</p>
                  <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsed}</span>
                  </div>
                </div>
              </div>
              <Badge className="bg-green-600 hover:bg-green-600 text-white">Active</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Current job */}
        {job && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Current Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{job.name}</span>
                <Badge variant="outline" className="text-xs">
                  {isMobile ? "Mobile" : "Static"}
                </Badge>
              </div>
              {job.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location.name}
                </p>
              )}
              {job.description && (
                <p className="text-sm text-muted-foreground">{job.description}</p>
              )}
              {activeCheckIn.checkInLat && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Check-in GPS: {parseFloat(activeCheckIn.checkInLat).toFixed(5)},{" "}
                  {parseFloat(activeCheckIn.checkInLng!).toFixed(5)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Keys available */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" />
              Keys Available to You
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isMobile ? (
              <p className="text-sm text-muted-foreground">
                As a mobile worker, you can view all keys in the system.
              </p>
            ) : job?.location ? (
              <p className="text-sm text-muted-foreground">
                You are on a static post. Only keys stored at <span className="font-medium text-foreground">{job.location.name}</span> are visible to you.
              </p>
            ) : (
              <p className="text-sm text-amber-600">
                This static post has no location linked — no keys are visible. Contact your admin to link a location.
              </p>
            )}
            {(!job || isMobile || job?.location) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/key-bunches")}
                className="w-full"
              >
                <Key className="w-4 h-4 mr-2" />
                {isMobile ? "View All Keys" : "View My Keys"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Check out */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full h-12 text-base">
              <LogOut className="w-4 h-4 mr-2" />
              Check Out
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Check out of lone working?</AlertDialogTitle>
              <AlertDialogDescription>
                This will end your active session after {elapsed}. Your manager will be notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 px-0">
              <Label htmlFor="checkout-notes">End of shift notes (optional)</Label>
              <Textarea
                id="checkout-notes"
                placeholder="Any notes for your manager…"
                value={checkOutNotes}
                onChange={e => setCheckOutNotes(e.target.value)}
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCheckOut}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={checkOutMutation.isPending}
              >
                {checkOutMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking out…</>
                ) : (
                  "Check Out"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className="text-center text-xs text-muted-foreground">
          Stay visible. Stay safe. Your check-in is recorded.
        </p>
      </div>
    </div>
  );
}
