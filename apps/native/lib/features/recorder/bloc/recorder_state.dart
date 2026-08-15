part of 'recorder_bloc.dart';

enum RecorderStatus { idle, recording, paused, stopped, error }

final class RecorderState extends Equatable {
  const RecorderState({
    this.status = RecorderStatus.idle,
    this.hasPermission = false,
    this.path,
    this.elapsed = Duration.zero,
    this.amplitudes = const [],
    this.isSilent = false,
    this.isClipping = false,
    this.error,
  });

  final RecorderStatus status;
  final bool hasPermission;
  final String? path;
  final Duration elapsed;
  final List<double> amplitudes;
  final bool isSilent;
  final bool isClipping;
  final String? error;

  RecorderState copyWith({
    RecorderStatus? status,
    bool? hasPermission,
    String? path,
    Duration? elapsed,
    List<double>? amplitudes,
    bool? isSilent,
    bool? isClipping,
    String? error,
    bool clearError = false,
  }) {
    return RecorderState(
      status: status ?? this.status,
      hasPermission: hasPermission ?? this.hasPermission,
      path: path ?? this.path,
      elapsed: elapsed ?? this.elapsed,
      amplitudes: amplitudes ?? this.amplitudes,
      isSilent: isSilent ?? this.isSilent,
      isClipping: isClipping ?? this.isClipping,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [
        status,
        hasPermission,
        path,
        elapsed,
        amplitudes,
        isSilent,
        isClipping,
        error,
      ];
}
