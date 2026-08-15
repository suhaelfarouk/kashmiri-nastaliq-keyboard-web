import 'dart:async';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../../core/config/app_config.dart';

class RecorderService {
  RecorderService({AudioRecorder? recorder}) : _recorder = recorder ?? AudioRecorder();

  final AudioRecorder _recorder;
  StreamSubscription<Amplitude>? _ampSub;
  final _amplitudeController = StreamController<double>.broadcast();

  Stream<double> get amplitudes => _amplitudeController.stream;

  Future<bool> hasPermission() => _recorder.hasPermission();

  Future<String> start() async {
    final ok = await _recorder.hasPermission();
    if (!ok) {
      throw StateError('Microphone permission denied');
    }
    final dir = await getTemporaryDirectory();
    final path = p.join(
      dir.path,
      'makhzan_${DateTime.now().millisecondsSinceEpoch}.wav',
    );
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: AppConfig.sampleRate,
        numChannels: 1,
        autoGain: true,
        echoCancel: true,
        noiseSuppress: true,
      ),
      path: path,
    );
    await _ampSub?.cancel();
    _ampSub = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 50))
        .listen((amp) {
      // Normalize dBFS (~-60..0) to 0..1 for waveform UI.
      final norm = ((amp.current + 60) / 60).clamp(0.0, 1.0);
      _amplitudeController.add(norm);
    });
    return path;
  }

  Future<void> pause() => _recorder.pause();
  Future<void> resume() => _recorder.resume();

  Future<String?> stop() async {
    await _ampSub?.cancel();
    _ampSub = null;
    return _recorder.stop();
  }

  Future<void> cancel(String? path) async {
    await _ampSub?.cancel();
    _ampSub = null;
    try {
      if (await _recorder.isRecording() || await _recorder.isPaused()) {
        // Platform cancel drops the in-progress file; do not stop()+delete.
        await _recorder.cancel();
      }
    } catch (_) {
      // Still attempt path cleanup below.
    }
    await _deleteQuietly(path);
  }

  Future<void> _deleteQuietly(String? path) async {
    if (path == null || path.isEmpty) return;
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    } on PathNotFoundException {
      // Already gone after platform cancel or a cache race on iOS.
    } on FileSystemException {
      // Ignore leftover cleanup failures; discard must not crash.
    }
  }

  Future<void> dispose() async {
    await _ampSub?.cancel();
    await _amplitudeController.close();
    await _recorder.dispose();
  }
}
