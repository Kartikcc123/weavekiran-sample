import stainImg from '../assets/swatches/stain.jpg';
import holeImg from '../assets/swatches/hole.jpg';
import threadImg from '../assets/swatches/thread_error.jpg';
import goodImg from '../assets/swatches/good.jpg';

/**
 * Maps a defect name to a preview swatch image.
 */
export function getDefectSwatch(defectType) {
  if (!defectType) return goodImg;
  const name = String(defectType).toLowerCase();
  if (name.includes('stain') || name.includes('oil') || name.includes('spot')) {
    return stainImg;
  }
  if (name.includes('hole') || name.includes('tear') || name.includes('cut')) {
    return holeImg;
  }
  if (name.includes('thread') || name.includes('warp') || name.includes('weft') || name.includes('yarn') || name.includes('snag')) {
    return threadImg;
  }
  if (name.includes('good') || name.includes('normal') || name.includes('clean')) {
    return goodImg;
  }
  // Default to stain or good depending on severity
  return stainImg;
}

/**
 * Severity configuration with colors and labels
 */
export const SEVERITY_CONFIG = {
  HIGH: {
    label: 'HIGH',
    badgeBg: '#FEE2E2',
    badgeText: '#DC2626',
    border: '#DC2626',
    dot: '#DC2626'
  },
  MEDIUM: {
    label: 'MEDIUM',
    badgeBg: '#FEF3C7',
    badgeText: '#D97706',
    border: '#D97706',
    dot: '#D97706'
  },
  LOW: {
    label: 'LOW',
    badgeBg: '#FEF9C3',
    badgeText: '#854D0E',
    border: '#FDE047',
    dot: '#CA8A04'
  },
  NORMAL: {
    label: 'NORMAL',
    badgeBg: '#DCFCE7',
    badgeText: '#16A34A',
    border: '#16A34A',
    dot: '#16A34A'
  }
};

/**
 * Sample historical detections matching the reference image layout
 * Used when real detection history is still empty or building up.
 */
export const SAMPLE_RECENT_INSPECTIONS = [
  {
    id: 'sample-1',
    type: 'Stain',
    confidence: 0.92,
    timestamp: new Date(Date.now() - 1000 * 45).toISOString(),
    image: stainImg,
    badgeColor: 'bg-[#EF4444] text-white',
    timeStr: '10:24:16 AM'
  },
  {
    id: 'sample-2',
    type: 'Thread Error',
    confidence: 0.87,
    timestamp: new Date(Date.now() - 1000 * 120).toISOString(),
    image: threadImg,
    badgeColor: 'bg-[#2563EB] text-white',
    timeStr: '10:23:41 AM'
  },
  {
    id: 'sample-3',
    type: 'Good',
    confidence: 0.96,
    timestamp: new Date(Date.now() - 1000 * 180).toISOString(),
    image: goodImg,
    badgeColor: 'bg-[#10B981] text-white',
    timeStr: '10:23:05 AM'
  },
  {
    id: 'sample-4',
    type: 'Hole',
    confidence: 0.89,
    timestamp: new Date(Date.now() - 1000 * 250).toISOString(),
    image: holeImg,
    badgeColor: 'bg-[#0284C7] text-white',
    timeStr: '10:22:18 AM'
  },
  {
    id: 'sample-5',
    type: 'Good',
    confidence: 0.91,
    timestamp: new Date(Date.now() - 1000 * 320).toISOString(),
    image: goodImg,
    badgeColor: 'bg-[#10B981] text-white',
    timeStr: '10:21:43 AM'
  },
  {
    id: 'sample-6',
    type: 'Stain',
    confidence: 0.88,
    timestamp: new Date(Date.now() - 1000 * 400).toISOString(),
    image: stainImg,
    badgeColor: 'bg-[#EF4444] text-white',
    timeStr: '10:20:56 AM'
  }
];
