import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import DOMPurify from 'isomorphic-dompurify'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Sanitize helper for any HTML we might inject (defense-in-depth)
export function sanitizeHtml(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_ATTR: ['href','title','target','rel'], ALLOWED_TAGS: ['a','p','span','strong','em','code','ul','ol','li','br'] })
}
