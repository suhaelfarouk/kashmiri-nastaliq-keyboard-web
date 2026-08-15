part of 'model_download_bloc.dart';

final class ModelDownloadState extends Equatable {
  const ModelDownloadState({
    this.phase = ModelInstallPhase.idle,
    this.progress = 0,
    this.paused = false,
    this.wifiOnly = true,
    this.installed,
    this.availableUpdate,
    this.downloadingVersion,
    this.error,
  });

  final ModelInstallPhase phase;
  final double progress;
  final bool paused;
  final bool wifiOnly;
  final InstalledModel? installed;
  final ModelManifest? availableUpdate;
  final String? downloadingVersion;
  final String? error;

  bool get isReady => phase == ModelInstallPhase.ready && installed != null;

  ModelDownloadState copyWith({
    ModelInstallPhase? phase,
    double? progress,
    bool? paused,
    bool? wifiOnly,
    InstalledModel? installed,
    ModelManifest? availableUpdate,
    String? downloadingVersion,
    String? error,
    bool clearError = false,
    bool clearAvailableUpdate = false,
  }) {
    return ModelDownloadState(
      phase: phase ?? this.phase,
      progress: progress ?? this.progress,
      paused: paused ?? this.paused,
      wifiOnly: wifiOnly ?? this.wifiOnly,
      installed: installed ?? this.installed,
      availableUpdate: clearAvailableUpdate ? null : (availableUpdate ?? this.availableUpdate),
      downloadingVersion: downloadingVersion ?? this.downloadingVersion,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [
        phase,
        progress,
        paused,
        wifiOnly,
        installed,
        availableUpdate,
        downloadingVersion,
        error,
      ];
}
