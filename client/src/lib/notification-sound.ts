let audioInstance: HTMLAudioElement | null = null;

export function playNotificationSound() {
  if (!audioInstance) {
    audioInstance = new Audio('/notification.mp3');
  }
  audioInstance.currentTime = 0;
  audioInstance.play().catch((error) => {
    console.warn('Failed to play notification sound:', error);
  });
}
