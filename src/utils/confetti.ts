export const triggerAscendingStarlight = (intensity: 'normal' | 'grand' = 'grand') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ghostty-starlight-surge', {
        detail: { count: intensity === 'grand' ? 75 : 45 },
      })
    );
  }
};

export const triggerLaunchConfetti = (_originX = 0.5, _originY = 0.5) => {
  triggerAscendingStarlight('grand');
};

export const triggerInstallSuccessConfetti = () => {
  triggerAscendingStarlight('normal');
};
