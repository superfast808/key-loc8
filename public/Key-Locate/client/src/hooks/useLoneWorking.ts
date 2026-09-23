import { useQuery } from "@tanstack/react-query";

export interface LwJob {
  id: number;
  name: string;
  jobType: string;
  locationId: number | null;
  description: string | null;
  isActive: boolean;
  location?: { id: number; name: string } | null;
}

export interface LwCheckIn {
  id: number;
  userId: number;
  companyId: number;
  jobId: number;
  shiftId: number | null;
  status: string;
  checkInTime: string;
  checkOutTime: string | null;
  checkInLat: string | null;
  checkInLng: string | null;
  checkOutLat: string | null;
  checkOutLng: string | null;
  notes: string | null;
}

export interface LwStatus {
  activeCheckIn: LwCheckIn | null;
  jobs: LwJob[];
}

export function useLoneWorking() {
  return useQuery<LwStatus>({
    queryKey: ["/api/lw/status"],
    staleTime: 30_000,
    retry: false,
  });
}
