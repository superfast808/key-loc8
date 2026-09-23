import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  
  return target.toLocaleDateString();
}

export function getBunchTypeColor(type: string): string {
  switch (type) {
    case "day_shift":
      return "bg-blue-100 text-blue-800";
    case "night_shift":
      return "bg-purple-100 text-purple-800";
    case "lock_ups":
      return "bg-orange-100 text-orange-800";
    case "static":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getBunchTypeName(type: string): string {
  switch (type) {
    case "day_shift":
      return "Day Shift";
    case "night_shift":
      return "Night Shift";
    case "lock_ups":
      return "Lock Ups";
    case "static":
      return "Static";
    default:
      return type;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "issued":
      return "bg-orange-100 text-orange-800";
    case "missing":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getStatusName(status: string): string {
  switch (status) {
    case "active":
      return "Present";
    case "issued":
      return "Issued";
    case "missing":
      return "Missing";
    default:
      return status;
  }
}

export function generateNewTag(): string {
  return `TAG-${Math.floor(Math.random() * 9000) + 1000}`;
}
