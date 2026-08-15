part of 'transcription_bloc.dart';

sealed class TranscriptionEvent extends Equatable {
  const TranscriptionEvent();
  @override
  List<Object?> get props => [];
}

final class TranscriptionModelBound extends TranscriptionEvent {
  const TranscriptionModelBound(this.model);
  final InstalledModel model;
  @override
  List<Object?> get props => [model];
}

final class TranscriptionRequested extends TranscriptionEvent {
  const TranscriptionRequested(this.wavPath);
  final String wavPath;
  @override
  List<Object?> get props => [wavPath];
}

final class TranscriptionTextEdited extends TranscriptionEvent {
  const TranscriptionTextEdited(this.text);
  final String text;
  @override
  List<Object?> get props => [text];
}

final class TranscriptionCleared extends TranscriptionEvent {
  const TranscriptionCleared();
}
