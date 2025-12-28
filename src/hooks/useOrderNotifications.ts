import { useRef, useCallback } from 'react';

// Simple beep sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for beep
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';
    
    // Fade out
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Play a second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 1046.5; // C6 note
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.5);
    }, 200);
    
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
};

export function useOrderNotifications() {
  const lastOrderCountRef = useRef<number | null>(null);
  const soundEnabledRef = useRef(true);

  const checkForNewOrders = useCallback((currentCount: number, previousCount: number | null) => {
    if (previousCount !== null && currentCount > previousCount && soundEnabledRef.current) {
      playNotificationSound();
    }
  }, []);

  const updateOrderCount = useCallback((count: number) => {
    checkForNewOrders(count, lastOrderCountRef.current);
    lastOrderCountRef.current = count;
  }, [checkForNewOrders]);

  const toggleSound = useCallback((enabled: boolean) => {
    soundEnabledRef.current = enabled;
  }, []);

  const playSound = useCallback(() => {
    if (soundEnabledRef.current) {
      playNotificationSound();
    }
  }, []);

  return {
    updateOrderCount,
    toggleSound,
    playSound,
    isSoundEnabled: soundEnabledRef.current,
  };
}
