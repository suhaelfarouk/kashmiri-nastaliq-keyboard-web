import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/config/app_config.dart';
import '../data/recorder_service.dart';

part 'recorder_event.dart';
part 'recorder_state.dart';

class RecorderBloc extends Bloc<RecorderEvent, RecorderState> {
  RecorderBloc(this._service) : super(const RecorderState()) {
    on<RecorderPermissionRequested>(_onPermission);
    on<RecorderStarted>(_onStart);
    on<RecorderPaused>(_onPause);
    on<RecorderResumed>(_onResume);
    on<RecorderStopped>(_onStop);
    on<RecorderCancelled>(_onCancel);
    on<_RecorderTick>(_onTick);
    on<_RecorderAmplitude>(_onAmp);

    _ampSub = _service.amplitudes.listen((a) => add(_RecorderAmplitude(a)));
  }

  final RecorderService _service;
  StreamSubscription<double>? _ampSub;
  Timer? _timer;

  Future<void> _onPermission(
    RecorderPermissionRequested event,
    Emitter<RecorderState> emit,
  ) async {
    final ok = await _service.hasPermission();
    emit(state.copyWith(hasPermission: ok));
  }

  Future<void> _onStart(RecorderStarted event, Emitter<RecorderState> emit) async {
    try {
      final path = await _service.start();
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => add(const _RecorderTick()));
      emit(
        state.copyWith(
          status: RecorderStatus.recording,
          path: path,
          elapsed: Duration.zero,
          amplitudes: const [],
          clearError: true,
        ),
      );
    } catch (e) {
      emit(state.copyWith(status: RecorderStatus.error, error: e.toString()));
    }
  }

  Future<void> _onPause(RecorderPaused event, Emitter<RecorderState> emit) async {
    await _service.pause();
    _timer?.cancel();
    emit(state.copyWith(status: RecorderStatus.paused));
  }

  Future<void> _onResume(RecorderResumed event, Emitter<RecorderState> emit) async {
    await _service.resume();
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => add(const _RecorderTick()));
    emit(state.copyWith(status: RecorderStatus.recording));
  }

  Future<void> _onStop(RecorderStopped event, Emitter<RecorderState> emit) async {
    _timer?.cancel();
    final path = await _service.stop();
    emit(
      state.copyWith(
        status: RecorderStatus.stopped,
        path: path ?? state.path,
      ),
    );
  }

  Future<void> _onCancel(RecorderCancelled event, Emitter<RecorderState> emit) async {
    _timer?.cancel();
    await _service.cancel(state.path);
    emit(const RecorderState());
  }

  void _onTick(_RecorderTick event, Emitter<RecorderState> emit) {
    final next = state.elapsed + const Duration(seconds: 1);
    if (next.inSeconds >= AppConfig.maxRecordingSeconds) {
      add(const RecorderStopped());
      return;
    }
    emit(state.copyWith(elapsed: next));
  }

  void _onAmp(_RecorderAmplitude event, Emitter<RecorderState> emit) {
    final next = [...state.amplitudes, event.value];
    final clipped = next.length > 64 ? next.sublist(next.length - 64) : next;
    final silent = event.value < 0.05;
    final clipping = event.value > 0.95;
    emit(
      state.copyWith(
        amplitudes: clipped,
        isSilent: silent,
        isClipping: clipping,
      ),
    );
  }

  @override
  Future<void> close() async {
    _timer?.cancel();
    await _ampSub?.cancel();
    await _service.dispose();
    return super.close();
  }
}
