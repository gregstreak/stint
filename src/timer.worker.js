// Runs in a separate thread — immune to tab backgrounding throttle
let interval = null;

self.onmessage = (e) => {
  const { type } = e.data;
  if (type === 'START') {
    if (interval) return;
    interval = setInterval(() => {
      self.postMessage({ type: 'TICK' });
    }, 1000);
  } else if (type === 'STOP') {
    clearInterval(interval);
    interval = null;
  }
};
