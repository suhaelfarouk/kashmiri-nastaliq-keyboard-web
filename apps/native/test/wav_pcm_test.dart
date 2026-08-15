import 'package:flutter_test/flutter_test.dart';
import 'package:makhzan/features/transcription/data/wav_pcm.dart';

void main() {
  test('decodes classic 44-byte PCM16 mono 16 kHz WAV', () {
    final wav = buildTestWav(pcm16: List<int>.filled(1600, 1000));
    final pcm = decodeWavToPcm16Mono16k(wav);
    expect(pcm.length, 1600);
    expect(pcm.first, 1000);
  });

  test('skips leading JUNK chunk (macOS record quirk)', () {
    final wav = buildTestWav(
      pcm16: List<int>.filled(800, 2000),
      junkBytes: 4096,
    );
    // Fixed-offset readers would see format=0 here.
    final pcm = decodeWavToPcm16Mono16k(wav);
    expect(pcm.length, 800);
    expect(pcm.first, 2000);
  });

  test('converts float32 WAV and resamples to 16 kHz', () {
    final wav = buildTestWav(
      pcm16: List<int>.filled(4800, 4000),
      sampleRate: 48000,
      audioFormat: 3,
      bitsPerSample: 32,
      junkBytes: 128,
    );
    final pcm = decodeWavToPcm16Mono16k(wav);
    expect(pcm.length, closeTo(1600, 2));
    expect(pcm.first.abs(), greaterThan(3000));
  });
}
