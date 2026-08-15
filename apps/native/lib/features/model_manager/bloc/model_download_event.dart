part of 'model_download_bloc.dart';

sealed class ModelDownloadEvent extends Equatable {
  const ModelDownloadEvent();
  @override
  List<Object?> get props => [];
}

final class ModelBootstrapRequested extends ModelDownloadEvent {
  const ModelBootstrapRequested();
}

final class ModelUpdateCheckRequested extends ModelDownloadEvent {
  const ModelUpdateCheckRequested();
}

final class ModelDownloadRequested extends ModelDownloadEvent {
  const ModelDownloadRequested({this.wifiOnly = true});
  final bool wifiOnly;
  @override
  List<Object?> get props => [wifiOnly];
}

final class ModelDownloadPaused extends ModelDownloadEvent {
  const ModelDownloadPaused();
}

final class ModelDownloadResumed extends ModelDownloadEvent {
  const ModelDownloadResumed();
}

final class ModelDownloadCancelled extends ModelDownloadEvent {
  const ModelDownloadCancelled();
}

final class ModelDownloadRetried extends ModelDownloadEvent {
  const ModelDownloadRetried();
}

final class _ModelTaskUpdated extends ModelDownloadEvent {
  const _ModelTaskUpdated(this.update);
  final TaskUpdate update;
  @override
  List<Object?> get props => [update];
}
