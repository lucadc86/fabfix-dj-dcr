let apiLoading = false;
let apiLoaded = false;
const apiReadyCallbacks: Array<() => void> = [];

export function loadYouTubeAPI(onReady: () => void): void {
  if (apiLoaded) { onReady(); return; }
  apiReadyCallbacks.push(onReady);
  if (apiLoading) return;
  apiLoading = true;
  window.onYouTubeIframeAPIReady = () => {
    apiLoaded = true;
    apiLoading = false;
    apiReadyCallbacks.forEach(cb => cb());
    apiReadyCallbacks.length = 0;
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}
