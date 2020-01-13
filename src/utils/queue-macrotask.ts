export function queueMacrotask(callback: () => void): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      try {
        callback();
        resolve();
      } catch (error) {
        reject(error);
      }
    }, 0)
  );
}
