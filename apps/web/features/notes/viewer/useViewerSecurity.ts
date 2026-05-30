import { useEffect, useState, RefObject } from 'react';

export function useViewerSecurity(viewerRef: RefObject<HTMLDivElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Security blockers (prevent print, save, copy, select all, context menu)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Native Fullscreen & Scroll Lock
  useEffect(() => {
    // Lock body scroll and native pinch zoom
    const originalTouchAction = document.documentElement.style.touchAction;
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
    
    // Listen for fullscreen exits (e.g., via ESC key)
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      document.documentElement.style.touchAction = originalTouchAction;
      document.documentElement.style.overflow = originalOverflow;
      document.removeEventListener('fullscreenchange', handleFsChange);
      
      // Ensure we exit fullscreen if unmounted
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return {
    isFullscreen,
    toggleFullscreen,
  };
}
