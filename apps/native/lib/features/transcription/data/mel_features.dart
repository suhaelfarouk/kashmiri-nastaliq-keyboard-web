import 'dart:math' as math;
import 'dart:typed_data';

/// Log-mel filterbank features matching NeMo `AudioToMelSpectrogramPreprocessor`
/// as configured by IndicConformer:
///
/// ```yaml
/// sample_rate: 16000
/// normalize: per_feature
/// window_size: 0.025      # win_length 400
/// window_stride: 0.01     # hop_length 160
/// window: hann            # symmetric (periodic=False)
/// features: 80
/// n_fft: 512
/// dither: 1.0e-05         # inference uses 0
/// pad_to: 0
/// ```
///
/// Verified against the NeMo preprocessor on fixture audio
/// (`test/fixtures/mel_golden.json`). Changing any constant here breaks the
/// model contract and must be re-verified against NeMo.
class MelFeatureConfig {
  const MelFeatureConfig({
    this.sampleRate = 16000,
    this.nFft = 512,
    this.winLength = 400,
    this.hopLength = 160,
    this.nMels = 80,
    this.fMin = 0.0,
    this.fMax = 8000.0,
    this.preemph = 0.97,
    this.logZeroGuard = 5.9604644775390625e-08, // 2^-24, NeMo default
    this.perFeatureNormalize = true,
    this.normalizeEpsilon = 1e-5,
  });

  final int sampleRate;
  final int nFft;
  final int winLength;
  final int hopLength;
  final int nMels;
  final double fMin;
  final double fMax;
  final double preemph;
  final double logZeroGuard;
  final bool perFeatureNormalize;
  final double normalizeEpsilon;

  factory MelFeatureConfig.fromJson(Map<String, dynamic>? json) {
    final feature = json?['feature'] as Map<String, dynamic>? ?? const {};
    final normalize = feature['normalize'] as String? ?? 'per_feature';
    return MelFeatureConfig(
      sampleRate: (json?['sample_rate'] as int?) ?? 16000,
      nFft: (feature['n_fft'] as int?) ?? 512,
      winLength: (feature['win_length'] as int?) ?? 400,
      hopLength: (feature['hop_length'] as int?) ?? 160,
      nMels: (feature['n_mels'] as int?) ?? 80,
      fMin: (feature['f_min'] as num?)?.toDouble() ?? 0.0,
      fMax: (feature['f_max'] as num?)?.toDouble() ?? 8000.0,
      preemph: (feature['preemph'] as num?)?.toDouble() ?? 0.97,
      logZeroGuard:
          (feature['log_zero_guard'] as num?)?.toDouble() ?? 5.9604644775390625e-08,
      perFeatureNormalize: normalize == 'per_feature',
    );
  }
}

class MelFeatures {
  const MelFeatures({
    required this.values,
    required this.frames,
    required this.nMels,
  });

  /// Row-major [nMels, frames].
  final Float32List values;
  final int frames;
  final int nMels;
}

/// Compute normalized log-mel features from PCM16 samples.
MelFeatures computeLogMel(
  List<int> pcm16, {
  MelFeatureConfig config = const MelFeatureConfig(),
}) {
  if (pcm16.isEmpty) {
    return MelFeatures(values: Float32List(0), frames: 0, nMels: config.nMels);
  }

  final waveform = Float64List(pcm16.length);
  for (var i = 0; i < pcm16.length; i++) {
    waveform[i] = pcm16[i] / 32768.0;
  }

  // NeMo applies pre-emphasis before the STFT, keeping sample 0 unchanged.
  for (var i = waveform.length - 1; i > 0; i--) {
    waveform[i] -= config.preemph * waveform[i - 1];
  }

  // torch.stft(center=True) reflect-pads by n_fft // 2.
  final pad = config.nFft ~/ 2;
  final padded = _reflectPad(waveform, pad);
  final frames = 1 + waveform.length ~/ config.hopLength;
  if (frames <= 0) {
    return MelFeatures(values: Float32List(0), frames: 0, nMels: config.nMels);
  }

  final window = _hannSymmetric(config.winLength);
  final filters = _slaneyMelFilterbank(config);
  // torch.stft centers a shorter window inside the FFT frame.
  final windowOffset = (config.nFft - config.winLength) ~/ 2;

  final fft = _Radix2Fft(config.nFft);
  final re = Float64List(config.nFft);
  final im = Float64List(config.nFft);
  final power = Float64List(config.nFft ~/ 2 + 1);
  final out = Float32List(config.nMels * frames);

  for (var f = 0; f < frames; f++) {
    final start = f * config.hopLength;
    re.fillRange(0, re.length, 0);
    im.fillRange(0, im.length, 0);
    for (var i = 0; i < config.winLength; i++) {
      final src = start + windowOffset + i;
      if (src >= padded.length) break;
      re[windowOffset + i] = padded[src] * window[i];
    }

    fft.transform(re, im);
    for (var k = 0; k < power.length; k++) {
      power[k] = re[k] * re[k] + im[k] * im[k];
    }

    for (var m = 0; m < config.nMels; m++) {
      final filter = filters[m];
      var energy = 0.0;
      for (var k = filter.start; k < filter.end; k++) {
        energy += filter.weights[k - filter.start] * power[k];
      }
      out[m * frames + f] = math.log(energy + config.logZeroGuard);
    }
  }

  if (config.perFeatureNormalize) {
    _normalizePerFeature(out, config, frames);
  }

  return MelFeatures(values: out, frames: frames, nMels: config.nMels);
}

/// Per-mel-bin mean/std normalization (NeMo `normalize_batch`, unbiased std).
void _normalizePerFeature(
  Float32List values,
  MelFeatureConfig config,
  int frames,
) {
  for (var m = 0; m < config.nMels; m++) {
    final base = m * frames;
    var sum = 0.0;
    for (var f = 0; f < frames; f++) {
      sum += values[base + f];
    }
    final mean = sum / frames;

    var sq = 0.0;
    for (var f = 0; f < frames; f++) {
      final d = values[base + f] - mean;
      sq += d * d;
    }
    final std = frames > 1
        ? math.sqrt(sq / (frames - 1)) + config.normalizeEpsilon
        : config.normalizeEpsilon;

    for (var f = 0; f < frames; f++) {
      values[base + f] = (values[base + f] - mean) / std;
    }
  }
}

Float64List _reflectPad(Float64List x, int pad) {
  final out = Float64List(x.length + 2 * pad);
  for (var i = 0; i < out.length; i++) {
    out[i] = x[_reflectIndex(i - pad, x.length)];
  }
  return out;
}

int _reflectIndex(int i, int n) {
  if (n == 1) return 0;
  final period = 2 * (n - 1);
  var j = i % period;
  if (j < 0) j += period;
  return j < n ? j : period - j;
}

/// `torch.hann_window(win_length, periodic=False)`.
Float64List _hannSymmetric(int n) {
  final w = Float64List(n);
  if (n == 1) {
    w[0] = 1;
    return w;
  }
  for (var i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * math.cos(2 * math.pi * i / (n - 1));
  }
  return w;
}

/// One triangular mel filter stored over its non-zero bin range only.
class _MelFilter {
  const _MelFilter(this.start, this.end, this.weights);
  final int start;
  final int end;
  final Float64List weights;
}

/// `librosa.filters.mel(...)` defaults: Slaney mel scale with Slaney area norm.
List<_MelFilter> _slaneyMelFilterbank(MelFeatureConfig config) {
  final nFreq = config.nFft ~/ 2 + 1;
  final melMin = _hzToMelSlaney(config.fMin);
  final melMax = _hzToMelSlaney(config.fMax);
  final hz = Float64List(config.nMels + 2);
  for (var i = 0; i < hz.length; i++) {
    final mel = melMin + (melMax - melMin) * i / (config.nMels + 1);
    hz[i] = _melToHzSlaney(mel);
  }

  final fftFreqs = Float64List(nFreq);
  for (var k = 0; k < nFreq; k++) {
    fftFreqs[k] = config.sampleRate / 2 * k / (nFreq - 1);
  }

  final filters = <_MelFilter>[];
  final row = Float64List(nFreq);
  for (var m = 0; m < config.nMels; m++) {
    final lowerDiff = hz[m + 1] - hz[m];
    final upperDiff = hz[m + 2] - hz[m + 1];
    final enorm = 2.0 / (hz[m + 2] - hz[m]);
    var start = nFreq;
    var end = 0;
    for (var k = 0; k < nFreq; k++) {
      final lower = (fftFreqs[k] - hz[m]) / lowerDiff;
      final upper = (hz[m + 2] - fftFreqs[k]) / upperDiff;
      final value = math.min(lower, upper);
      row[k] = value > 0 ? value * enorm : 0.0;
      if (row[k] != 0) {
        if (k < start) start = k;
        end = k + 1;
      }
    }
    if (start >= end) {
      filters.add(_MelFilter(0, 0, Float64List(0)));
      continue;
    }
    filters.add(
      _MelFilter(start, end, Float64List.fromList(row.sublist(start, end))),
    );
  }
  return filters;
}

const _melLinearMax = 1000.0;
const _melFSp = 200.0 / 3.0;
final double _melLogStart = _melLinearMax / _melFSp;
final double _melLogStep = math.log(6.4) / 27.0;

double _hzToMelSlaney(double hz) => hz < _melLinearMax
    ? hz / _melFSp
    : _melLogStart + math.log(hz / _melLinearMax) / _melLogStep;

double _melToHzSlaney(double mel) => mel < _melLogStart
    ? mel * _melFSp
    : _melLinearMax * math.exp(_melLogStep * (mel - _melLogStart));

/// In-place iterative radix-2 FFT (n must be a power of two).
class _Radix2Fft {
  _Radix2Fft(this.n)
      : _levels = _log2Exact(n),
        _cos = Float64List(n ~/ 2),
        _sin = Float64List(n ~/ 2) {
    for (var i = 0; i < n ~/ 2; i++) {
      _cos[i] = math.cos(2 * math.pi * i / n);
      _sin[i] = math.sin(2 * math.pi * i / n);
    }
  }

  final int n;
  final int _levels;
  final Float64List _cos;
  final Float64List _sin;

  void transform(Float64List re, Float64List im) {
    for (var i = 0; i < n; i++) {
      final j = _reverseBits(i, _levels);
      if (j > i) {
        var t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }

    for (var size = 2; size <= n; size *= 2) {
      final half = size ~/ 2;
      final step = n ~/ size;
      for (var i = 0; i < n; i += size) {
        for (var j = i, k = 0; j < i + half; j++, k += step) {
          final l = j + half;
          final tpRe = re[l] * _cos[k] + im[l] * _sin[k];
          final tpIm = -re[l] * _sin[k] + im[l] * _cos[k];
          re[l] = re[j] - tpRe;
          im[l] = im[j] - tpIm;
          re[j] += tpRe;
          im[j] += tpIm;
        }
      }
    }
  }

  static int _log2Exact(int n) {
    var levels = 0;
    var value = n;
    while (value > 1) {
      if (value.isOdd) {
        throw ArgumentError('n_fft must be a power of two, got $n');
      }
      value >>= 1;
      levels++;
    }
    return levels;
  }

  static int _reverseBits(int x, int bits) {
    var result = 0;
    for (var i = 0; i < bits; i++) {
      result = (result << 1) | ((x >> i) & 1);
    }
    return result;
  }
}
