part of 'recorder_bloc.dart';

sealed class RecorderEvent extends Equatable {
  const RecorderEvent();
  @override
  List<Object?> get props => [];
}

final class RecorderPermissionRequested extends RecorderEvent {
  const RecorderPermissionRequested();
}

final class RecorderStarted extends RecorderEvent {
  const RecorderStarted();
}

final class RecorderPaused extends RecorderEvent {
  const RecorderPaused();
}

final class RecorderResumed extends RecorderEvent {
  const RecorderResumed();
}

final class RecorderStopped extends RecorderEvent {
  const RecorderStopped();
}

final class RecorderCancelled extends RecorderEvent {
  const RecorderCancelled();
}

final class _RecorderTick extends RecorderEvent {
  const _RecorderTick();
}

final class _RecorderAmplitude extends RecorderEvent {
  const _RecorderAmplitude(this.value);
  final double value;
  @override
  List<Object?> get props => [value];
}
