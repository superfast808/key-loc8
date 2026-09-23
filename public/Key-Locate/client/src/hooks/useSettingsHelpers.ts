import { useQuery } from "@tanstack/react-query";
import { AppSettings } from "@shared/settings";

/**
 * CRITICAL: Type Matching System for Multi-Company Custom Types
 * 
 * This module provides type-safe matching that works with ANY custom company configuration.
 * 
 * RULES FOR DEVELOPERS:
 * 1. ALWAYS use type.id as the value in <SelectItem> dropdowns
 * 2. ALWAYS use typesMatch() when comparing types in filters
 * 3. NEVER hardcode type values like "day_shift" or "Day Shift"
 * 4. NEVER use type.name or type.displayName as dropdown values
 * 
 * WHY: Companies can customize type IDs (e.g., "keyTypes_1761818438421_xxx")
 * Legacy data may use old formats (e.g., "day_shift" vs "Day Shift")
 * This system handles all formats automatically for all companies.
 * 
 * CORRECT USAGE:
 * - Dropdown: <SelectItem value={type.id}>{type.displayName}</SelectItem>
 * - Filtering: bunches.filter(b => typesMatch(b.type, selectedType))
 * - Display: getTypeDisplayName(bunch.type)
 * 
 * INCORRECT USAGE:
 * - Dropdown: <SelectItem value={type.name}>... ❌
 * - Filtering: bunch.type === selectedType ❌
 * - Hardcoded: <SelectItem value="day_shift">... ❌
 */

export function useSettingsHelpers() {
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const getTypeDisplayName = (typeId: string) => {
    if (!typeId || !settings?.keyTypes) return typeId || "";
    const type = settings.keyTypes.find(t => t.id === typeId);
    return type?.displayName || typeId;
  };

  const getStatusDisplayName = (statusId: string) => {
    if (!statusId || !settings?.statuses) return statusId || "";
    const status = settings.statuses.find(s => s.id === statusId);
    return status?.displayName || statusId;
  };

  const getLocationTypeDisplayName = (typeId: string) => {
    if (!typeId || !settings?.locationTypes) return typeId || "";
    const locType = settings.locationTypes.find(t => t.id === typeId);
    return locType?.displayName || typeId;
  };

  const getActionTypeDisplayName = (typeId: string) => {
    if (!typeId || !settings?.actions) return typeId || "";
    // Match by ID first, then by canonical name (for companies with custom IDs)
    const actionType = settings.actions.find((t: any) => t.id === typeId || t.name === typeId);
    if (actionType) return actionType.displayName;
    // Fallback: format the canonical string nicely
    return typeId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  // Normalize type to ID - handles both ID and display name inputs
  const normalizeTypeToId = (typeValue: string): string => {
    if (!typeValue || !settings?.keyTypes) return typeValue || "";
    // First check if it's already an ID
    const byId = settings.keyTypes.find((t: any) => t.id === typeValue);
    if (byId) return byId.id;
    // Then check if it's a display name or name (legacy data)
    const byName = settings.keyTypes.find((t: any) => 
      t.displayName === typeValue || t.name === typeValue
    );
    return byName ? byName.id : typeValue;
  };

  // Check if two type values match (handles ID and display name)
  const typesMatch = (type1: string, type2: string): boolean => {
    if (!type1 || !type2) return false;
    const id1 = normalizeTypeToId(type1);
    const id2 = normalizeTypeToId(type2);
    return id1 === id2;
  };

  const getTypeColor = (typeId: string) => {
    if (!typeId || !settings?.keyTypes) return "bg-gray-100 text-gray-800";
    // Look up by ID first, then fallback to display name or name for legacy data
    const type = settings.keyTypes.find(t => 
      t.id === typeId || t.displayName === typeId || t.name === typeId
    );
    if (!type?.color) return "bg-gray-100 text-gray-800";
    
    return getColorClass(type.color);
  };

  const getStatusColor = (statusId: string) => {
    if (!statusId || !settings?.statuses) return "bg-gray-100 text-gray-800";
    // Look up by ID first, then fallback to display name or name for legacy data
    const status = settings.statuses.find(s => 
      s.id === statusId || s.displayName === statusId || s.name === statusId
    );
    if (!status?.color) return "bg-gray-100 text-gray-800";
    
    return getColorClass(status.color);
  };

  const getColorClass = (hexColor: string): string => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const hue = rgbToHue(r, g, b);
    
    if (hue >= 0 && hue < 30) return "bg-red-100 text-red-800";
    if (hue >= 30 && hue < 60) return "bg-yellow-100 text-yellow-800";
    if (hue >= 60 && hue < 150) return "bg-green-100 text-green-800";
    if (hue >= 150 && hue < 210) return "bg-cyan-100 text-cyan-800";
    if (hue >= 210 && hue < 270) return "bg-blue-100 text-blue-800";
    if (hue >= 270 && hue < 330) return "bg-purple-100 text-purple-800";
    return "bg-red-100 text-red-800";
  };

  const rgbToHue = (r: number, g: number, b: number): number => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    if (delta === 0) return 0;
    
    let hue = 0;
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
    
    return hue;
  };

  return {
    settings,
    getTypeDisplayName,
    getStatusDisplayName,
    getLocationTypeDisplayName,
    getActionTypeDisplayName,
    getActionDisplayName: getActionTypeDisplayName, // Alias for consistency
    getTypeColor,
    getStatusColor,
    normalizeTypeToId,
    typesMatch,
  };
}
