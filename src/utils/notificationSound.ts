/**
 * Shared Web Audio helper for notification chimes.
 * Browsers leave AudioContext suspended until a user gesture — unlock from
 * toggle/save clicks so later poll-driven chimes can play.
 */

type AudioContextConstructor = typeof AudioContext;

let sharedContext: AudioContext | null = null;
let unlockArmed = false;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext || null;
}

function getSharedContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    try {
      sharedContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedContext;
}

function armGestureUnlock() {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const options = { capture: true } as const;
  const unlock = () => {
    const ctx = getSharedContext();
    if (!ctx || ctx.state === "running") {
      disarm();
      return;
    }
    void ctx.resume().then(disarm, () => {
      /* keep armed if resume fails */
    });
  };
  const disarm = () => {
    unlockArmed = false;
    window.removeEventListener("pointerdown", unlock, options);
    window.removeEventListener("keydown", unlock, options);
  };
  window.addEventListener("pointerdown", unlock, options);
  window.addEventListener("keydown", unlock, options);
}

function playTone(ctx: AudioContext) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = 800;
  oscillator.type = "sine";

  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  oscillator.start(now);
  oscillator.stop(now + 0.5);
}

/** Ensure the shared AudioContext is running (must be called from a user gesture when possible). */
export async function unlockNotificationAudio(): Promise<boolean> {
  const ctx = getSharedContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    if (ctx.state !== "running") {
      armGestureUnlock();
      return false;
    }
    return true;
  } catch {
    armGestureUnlock();
    return false;
  }
}

/** Play the notification chime if audio is unlocked; otherwise arm unlock for the next gesture. */
export async function playNotificationSound(): Promise<boolean> {
  const ctx = getSharedContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    if (ctx.state !== "running") {
      armGestureUnlock();
      return false;
    }
    playTone(ctx);
    return true;
  } catch (e) {
    console.warn("Could not play notification sound", e);
    armGestureUnlock();
    return false;
  }
}

/** Unlock + play a short preview (call from sound-toggle / save click handlers). */
export async function previewNotificationSound(): Promise<boolean> {
  const unlocked = await unlockNotificationAudio();
  if (!unlocked) return false;
  return playNotificationSound();
}
