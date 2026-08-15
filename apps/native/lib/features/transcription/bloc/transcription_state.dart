part of 'transcription_bloc.dart';

enum TranscriptionStatus { idle, loadingModel, processing, ready, error }

final class TranscriptionState extends Equatable {
  const TranscriptionState({
    this.status = TranscriptionStatus.idle,
    this.text = '',
    this.sourcePath,
    this.modelVersion,
    this.error,
  });

  final TranscriptionStatus status;
  final String text;
  final String? sourcePath;
  final String? modelVersion;
  final String? error;

  TranscriptionState copyWith({
    TranscriptionStatus? status,
    String? text,
    String? sourcePath,
    String? modelVersion,
    String? error,
    bool clearError = false,
  }) {
    return TranscriptionState(
      status: status ?? this.status,
      text: text ?? this.text,
      sourcePath: sourcePath ?? this.sourcePath,
      modelVersion: modelVersion ?? this.modelVersion,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, text, sourcePath, modelVersion, error];
}
