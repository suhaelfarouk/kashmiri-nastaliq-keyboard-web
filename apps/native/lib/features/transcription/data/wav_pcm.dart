import 'dart:math' as math;
import 'dart:typed_data';

/// Decode a WAV container into PCM16 mono samples at 16 kHz.
///
/// Handles common platform quirks from the `record` package on macOS:
/// - `JUNK` (or other) chunks before `fmt ` / `data`
/// - IEEE float PCM (format 3) in addition to integer PCM (format 1)
/// - stereo → mono downmix
/// - sample-rate conversion to 16 kHz
List<int> decodeWavToPcm16Mono16k(Uint8List bytes) {
  if (bytes.length < 12) {
    throw StateError('WAV too short (${bytes.length} bytes)');
  }
  final data = ByteData.sublistView(bytes);
  final riff = String.fromCharCodes(bytes.sublist(0, 4));
  final wave = String.fromCharCodes(bytes.sublist(8, 12));
  if (riff != 'RIFF' || wave != 'WAVE') {
    throw StateError('Not a RIFF/WAVE file');
  }

  var offset = 12;
  _Fmt? fmt;
  int? dataOffset;
  var dataSize = 0;

  while (offset + 8 <= bytes.length) {
    final id = String.fromCharCodes(bytes.sublist(offset, offset + 4));
    final size = data.getUint32(offset + 4, Endian.little);
    final body = offset + 8;
    if (body + size > bytes.length) {
      throw StateError('WAV chunk "$id" truncated');
    }

    if (id == 'fmt ') {
      fmt = _parseFmt(data, body, size);
    } else if (id == 'data') {
      dataOffset = body;
      dataSize = size;
    }

    // Chunks are word-aligned.
    offset = body + size + (size.isOdd ? 1 : 0);
  }

  if (fmt == null) {
    throw StateError('WAV missing fmt chunk');
  }
  if (dataOffset == null) {
    throw StateError('WAV missing data chunk');
  }

  final samples = _decodeSamples(
    data,
    dataOffset: dataOffset,
    dataSize: dataSize,
    fmt: fmt,
  );
  final mono = _toMono(samples, fmt.channels);
  return _resample(mono, fromRate: fmt.sampleRate, toRate: 16000);
}

class _Fmt {
  const _Fmt({
    required this.audioFormat,
    required this.channels,
    required this.sampleRate,
    required this.bitsPerSample,
  });

  final int audioFormat;
  final int channels;
  final int sampleRate;
  final int bitsPerSample;
}

_Fmt _parseFmt(ByteData data, int body, int size) {
  if (size < 16) {
    throw StateError('WAV fmt chunk too small');
  }
  var audioFormat = data.getUint16(body, Endian.little);
  final channels = data.getUint16(body + 2, Endian.little);
  final sampleRate = data.getUint32(body + 4, Endian.little);
  final bitsPerSample = data.getUint16(body + 14, Endian.little);

  // WAVE_FORMAT_EXTENSIBLE
  if (audioFormat == 0xFFFE && size >= 40) {
    audioFormat = data.getUint16(body + 24, Endian.little);
  }

  if (channels < 1) {
    throw StateError('WAV has zero channels');
  }
  if (sampleRate < 1) {
    throw StateError('WAV has invalid sample rate');
  }

  return _Fmt(
    audioFormat: audioFormat,
    channels: channels,
    sampleRate: sampleRate,
    bitsPerSample: bitsPerSample,
  );
}

Float64List _decodeSamples(
  ByteData data, {
  required int dataOffset,
  required int dataSize,
  required _Fmt fmt,
}) {
  final end = math.min(dataOffset + dataSize, data.lengthInBytes);
  final bytesPerSample = fmt.bitsPerSample ~/ 8;
  if (bytesPerSample <= 0) {
    throw StateError('Unsupported bitsPerSample=${fmt.bitsPerSample}');
  }

  if (fmt.audioFormat == 1) {
    // Integer PCM
    if (fmt.bitsPerSample == 16) {
      final count = (end - dataOffset) ~/ 2;
      final out = Float64List(count);
      for (var i = 0; i < count; i++) {
        out[i] = data.getInt16(dataOffset + i * 2, Endian.little).toDouble();
      }
      return out;
    }
    if (fmt.bitsPerSample == 32) {
      final count = (end - dataOffset) ~/ 4;
      final out = Float64List(count);
      for (var i = 0; i < count; i++) {
        out[i] = data.getInt32(dataOffset + i * 4, Endian.little) / 65536.0;
      }
      return out;
    }
    throw StateError('Unsupported PCM bitsPerSample=${fmt.bitsPerSample}');
  }

  if (fmt.audioFormat == 3 && fmt.bitsPerSample == 32) {
    // IEEE float
    final count = (end - dataOffset) ~/ 4;
    final out = Float64List(count);
    for (var i = 0; i < count; i++) {
      out[i] = data.getFloat32(dataOffset + i * 4, Endian.little) * 32768.0;
    }
    return out;
  }

  throw StateError(
    'Unsupported WAV format=${fmt.audioFormat} bits=${fmt.bitsPerSample}',
  );
}

Float64List _toMono(Float64List interleaved, int channels) {
  if (channels == 1) return interleaved;
  final frames = interleaved.length ~/ channels;
  final out = Float64List(frames);
  for (var i = 0; i < frames; i++) {
    var sum = 0.0;
    for (var c = 0; c < channels; c++) {
      sum += interleaved[i * channels + c];
    }
    out[i] = sum / channels;
  }
  return out;
}

List<int> _resample(
  Float64List mono, {
  required int fromRate,
  required int toRate,
}) {
  if (mono.isEmpty) return const [];
  if (fromRate == toRate) {
    return List<int>.generate(mono.length, (i) => _clamp16(mono[i]));
  }

  final outLen = math.max(1, (mono.length * toRate / fromRate).round());
  final out = List<int>.filled(outLen, 0);
  for (var i = 0; i < outLen; i++) {
    final src = i * fromRate / toRate;
    final left = src.floor();
    final right = math.min(left + 1, mono.length - 1);
    final frac = src - left;
    final sample = mono[left] * (1 - frac) + mono[right] * frac;
    out[i] = _clamp16(sample);
  }
  return out;
}

int _clamp16(double sample) {
  if (sample.isNaN) return 0;
  return sample.round().clamp(-32768, 32767);
}

/// Build a minimal PCM16 mono WAV (optionally with a leading JUNK chunk).
Uint8List buildTestWav({
  required List<int> pcm16,
  int sampleRate = 16000,
  int channels = 1,
  int junkBytes = 0,
  int audioFormat = 1,
  int bitsPerSample = 16,
}) {
  final bytesPerSample = bitsPerSample ~/ 8;
  late final Uint8List pcmBytes;
  if (audioFormat == 1 && bitsPerSample == 16) {
    pcmBytes = Uint8List(pcm16.length * 2);
    final bd = ByteData.sublistView(pcmBytes);
    for (var i = 0; i < pcm16.length; i++) {
      bd.setInt16(i * 2, pcm16[i], Endian.little);
    }
  } else if (audioFormat == 3 && bitsPerSample == 32) {
    pcmBytes = Uint8List(pcm16.length * 4);
    final bd = ByteData.sublistView(pcmBytes);
    for (var i = 0; i < pcm16.length; i++) {
      bd.setFloat32(i * 4, pcm16[i] / 32768.0, Endian.little);
    }
  } else {
    throw ArgumentError('Unsupported test format');
  }

  final fmtSize = 16;
  final junkChunk = junkBytes > 0 ? 8 + junkBytes + (junkBytes.isOdd ? 1 : 0) : 0;
  final riffSize = 4 + junkChunk + (8 + fmtSize) + (8 + pcmBytes.length);
  final out = Uint8List(8 + riffSize);
  final bd = ByteData.sublistView(out);
  var o = 0;

  void writeId(String id) {
    out.setRange(o, o + 4, id.codeUnits);
    o += 4;
  }

  writeId('RIFF');
  bd.setUint32(o, riffSize, Endian.little);
  o += 4;
  writeId('WAVE');

  if (junkBytes > 0) {
    writeId('JUNK');
    bd.setUint32(o, junkBytes, Endian.little);
    o += 4;
    o += junkBytes + (junkBytes.isOdd ? 1 : 0);
  }

  writeId('fmt ');
  bd.setUint32(o, fmtSize, Endian.little);
  o += 4;
  bd.setUint16(o, audioFormat, Endian.little);
  o += 2;
  bd.setUint16(o, channels, Endian.little);
  o += 2;
  bd.setUint32(o, sampleRate, Endian.little);
  o += 4;
  final byteRate = sampleRate * channels * bytesPerSample;
  bd.setUint32(o, byteRate, Endian.little);
  o += 4;
  bd.setUint16(o, channels * bytesPerSample, Endian.little);
  o += 2;
  bd.setUint16(o, bitsPerSample, Endian.little);
  o += 2;

  writeId('data');
  bd.setUint32(o, pcmBytes.length, Endian.little);
  o += 4;
  out.setRange(o, o + pcmBytes.length, pcmBytes);
  return out;
}
