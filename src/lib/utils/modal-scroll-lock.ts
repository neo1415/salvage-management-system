/**
 * Modal Scroll Lock Utility
 * 
 * Prevents body scrolling when modals are open
 * Handles multiple modals being open at once
 */

let lockCount = 0;
let originalStyles: {
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  htmlOverflow: string;
} | null = null;
let scrollPosition = 0;

export function lockScroll(): () => void {
  if (lockCount === 0) {
    // Save current scroll position
    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    // Save original styles
    originalStyles = {
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      htmlOverflow: document.documentElement.style.overflow,
    };
    
    // Lock scroll
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
  }
  
  lockCount++;
  
  // Return unlock function
  return () => {
    lockCount = Math.max(0, lockCount - 1);
    
    if (lockCount === 0 && originalStyles) {
      // Restore original styles
      document.documentElement.style.overflow = originalStyles.htmlOverflow;
      document.body.style.overflow = originalStyles.bodyOverflow;
      document.body.style.position = originalStyles.bodyPosition;
      document.body.style.top = originalStyles.bodyTop;
      document.body.style.width = originalStyles.bodyWidth;
      
      // Restore scroll position
      window.scrollTo(0, scrollPosition);
      
      originalStyles = null;
    }
  };
}
