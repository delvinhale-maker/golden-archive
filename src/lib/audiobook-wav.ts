/**
 * AurumVault Audiobook Studio — Phase 2 WAV assembly + inspection.
 *
 * Pure (no Node/Worker APIs beyond typed arrays), so the mock provider can
 * build genuinely valid PCM WAV audio and the QC layer can inspect real
 * signal-level metrics with no external calls or paid providers.
 */

export type WavFormat = {
  sampleRate: number;
  channels: number;
  bitsPerSample: 16;
};

export const DEFAULT_WAV_FORMAT: WavFormat = {
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
};

export type WavInfo = {
  ok: boolean;
  reason?: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSeconds: number;
  /** Fraction of samples at/near full scale — clipping signal. */
  clippedRatio: number;
  /** Fraction of samples effectively silent — dead-air signal. */
  silentRatio: number;
  /** Declared data size vs actual bytes present. */
  truncated: boolean;
};

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Wraps raw 16-bit little-endian PCM in a standards-compliant RIFF/WAVE container. */
export function pcmToWav(pcm: Int16Array, format: WavFormat = DEFAULT_WAV_FORMAT): Uint8Array {
  const bytesPerSample = format.bitsPerSample / 8;
  const blockAlign = format.channels * bytesPerSample;
  const dataBytes = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, format.bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * bytesPerSample, pcm[i] ?? 0, true);
  }
  return new Uint8Array(buffer);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[start + i] ?? 0);
  return s;
}

/** Parses + signal-inspects a WAV buffer. Never throws. */
export function inspectWav(bytes: Uint8Array): WavInfo {
  const empty: WavInfo = {
    ok: false,
    sampleRate: 0,
    channels: 0,
    bitsPerSample: 0,
    dataBytes: 0,
    durationSeconds: 0,
    clippedRatio: 0,
    silentRatio: 1,
    truncated: true,
  };

  if (bytes.byteLength < 44) return { ...empty, reason: "WAV is shorter than a RIFF header." };
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") {
    return { ...empty, reason: "Not a RIFF/WAVE file." };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  // Walk chunks to find `data` (mock writes it at 36, real providers may not).
  let offset = 12;
  let dataOffset = -1;
  let declaredDataBytes = 0;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === "data") {
      dataOffset = offset + 8;
      declaredDataBytes = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) return { ...empty, reason: "WAV has no data chunk." };

  const availableBytes = Math.max(0, bytes.byteLength - dataOffset);
  const truncated = declaredDataBytes > availableBytes;
  const dataBytes = Math.min(declaredDataBytes, availableBytes);

  if (bitsPerSample !== 16) {
    return {
      ok: false,
      reason: `Unsupported bit depth ${bitsPerSample} (expected 16-bit PCM).`,
      sampleRate,
      channels,
      bitsPerSample,
      dataBytes,
      durationSeconds: 0,
      clippedRatio: 0,
      silentRatio: 1,
      truncated,
    };
  }

  const sampleCount = Math.floor(dataBytes / 2);
  let clipped = 0;
  let silent = 0;
  for (let i = 0; i < sampleCount; i++) {
    const s = view.getInt16(dataOffset + i * 2, true);
    const abs = Math.abs(s);
    if (abs >= 32700) clipped++;
    if (abs <= 64) silent++;
  }

  const frames = channels > 0 ? sampleCount / channels : 0;
  const durationSeconds = sampleRate > 0 ? frames / sampleRate : 0;

  return {
    ok: !truncated && sampleCount > 0 && sampleRate > 0 && channels > 0,
    reason: truncated
      ? "WAV data chunk is truncated."
      : sampleCount === 0
        ? "WAV contains no audio samples."
        : undefined,
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes,
    durationSeconds,
    clippedRatio: sampleCount > 0 ? clipped / sampleCount : 0,
    silentRatio: sampleCount > 0 ? silent / sampleCount : 1,
    truncated,
  };
}