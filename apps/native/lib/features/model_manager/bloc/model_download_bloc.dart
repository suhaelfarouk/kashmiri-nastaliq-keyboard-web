import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:background_downloader/background_downloader.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:path/path.dart' as p;

import '../../../core/model/model_manifest.dart';
import '../../../core/model/model_store.dart';
import '../data/model_download_service.dart';

part 'model_download_event.dart';
part 'model_download_state.dart';

class ModelDownloadBloc extends Bloc<ModelDownloadEvent, ModelDownloadState> {
  ModelDownloadBloc(this._service) : super(const ModelDownloadState()) {
    on<ModelBootstrapRequested>(_onBootstrap);
    on<ModelUpdateCheckRequested>(_onCheck);
    on<ModelDownloadRequested>(_onDownload);
    on<ModelDownloadPaused>(_onPause);
    on<ModelDownloadResumed>(_onResume);
    on<ModelDownloadCancelled>(_onCancel);
    on<ModelDownloadRetried>(_onRetry);
    on<_ModelTaskUpdated>(_onTaskUpdate);

    _updatesSub = _service.updates.listen((update) {
      add(_ModelTaskUpdated(update));
    });
  }

  final ModelDownloadService _service;
  StreamSubscription<TaskUpdate>? _updatesSub;
  DownloadTask? _activeTask;
  ModelManifest? _pendingManifest;
  int _attempt = 0;

  Future<void> _onBootstrap(
    ModelBootstrapRequested event,
    Emitter<ModelDownloadState> emit,
  ) async {
    emit(state.copyWith(phase: ModelInstallPhase.checking, clearError: true));
    await _service.trackTasks();
    final installed = await _service.current();
    if (installed != null) {
      emit(
        state.copyWith(
          phase: ModelInstallPhase.ready,
          installed: installed,
          progress: 1,
        ),
      );
      // Soft update check — does not block recording.
      try {
        final signed = await _service.fetchManifest();
        if (signed.manifest.version != installed.version) {
          emit(state.copyWith(availableUpdate: signed.manifest));
        }
      } catch (_) {
        /* offline is fine */
      }
      return;
    }
    emit(state.copyWith(phase: ModelInstallPhase.idle, installed: null));
  }

  Future<void> _onCheck(
    ModelUpdateCheckRequested event,
    Emitter<ModelDownloadState> emit,
  ) async {
    emit(state.copyWith(phase: ModelInstallPhase.checking, clearError: true));
    try {
      final signed = await _service.fetchManifest();
      final installed = await _service.current();
      final update = installed == null || signed.manifest.version != installed.version
          ? signed.manifest
          : null;
      emit(
        state.copyWith(
          phase: installed != null ? ModelInstallPhase.ready : ModelInstallPhase.idle,
          installed: installed,
          availableUpdate: update,
          clearAvailableUpdate: update == null,
        ),
      );
    } catch (e) {
      emit(state.copyWith(phase: ModelInstallPhase.failed, error: e.toString()));
    }
  }

  Future<void> _onDownload(
    ModelDownloadRequested event,
    Emitter<ModelDownloadState> emit,
  ) async {
    emit(state.copyWith(phase: ModelInstallPhase.checking, clearError: true, progress: 0));
    try {
      final wifiOk = await _service.wifiOnlyOk(wifiOnly: event.wifiOnly);
      if (!wifiOk) {
        emit(
          state.copyWith(
            phase: ModelInstallPhase.failed,
            error: 'Wi-Fi required. Connect to Wi-Fi or disable Wi-Fi only.',
          ),
        );
        return;
      }

      final signed = await _service.fetchManifest();
      _pendingManifest = signed.manifest;
      _attempt = 0;

      // Disk space heuristic: need ~2x archive size.
      final staging = await ModelStore().stagingDir();
      final free = await _freeBytes(staging);
      if (free != null && free < signed.manifest.artifact.bytes * 2) {
        emit(
          state.copyWith(
            phase: ModelInstallPhase.failed,
            error: 'Not enough free disk space for the model download.',
          ),
        );
        return;
      }

      _activeTask = await _service.enqueueDownload(
        manifest: signed.manifest,
        wifiOnly: event.wifiOnly,
      );
      emit(
        state.copyWith(
          phase: ModelInstallPhase.downloading,
          progress: 0,
          wifiOnly: event.wifiOnly,
          downloadingVersion: signed.manifest.version,
        ),
      );
    } catch (e) {
      emit(state.copyWith(phase: ModelInstallPhase.failed, error: e.toString()));
    }
  }

  Future<void> _onPause(ModelDownloadPaused event, Emitter<ModelDownloadState> emit) async {
    final task = _activeTask;
    if (task == null) return;
    await _service.pause(task);
    emit(state.copyWith(paused: true));
  }

  Future<void> _onResume(ModelDownloadResumed event, Emitter<ModelDownloadState> emit) async {
    final task = _activeTask;
    if (task == null) return;
    await _service.resume(task);
    emit(state.copyWith(paused: false, phase: ModelInstallPhase.downloading));
  }

  Future<void> _onCancel(ModelDownloadCancelled event, Emitter<ModelDownloadState> emit) async {
    final task = _activeTask;
    if (task != null) await _service.cancel(task);
    _activeTask = null;
    emit(state.copyWith(phase: ModelInstallPhase.idle, progress: 0, paused: false));
  }

  Future<void> _onRetry(ModelDownloadRetried event, Emitter<ModelDownloadState> emit) async {
    _attempt += 1;
    final delayMs = min(30000, (500 * pow(2, _attempt)).toInt()) + Random().nextInt(400);
    await Future<void>.delayed(Duration(milliseconds: delayMs));
    add(ModelDownloadRequested(wifiOnly: state.wifiOnly));
  }

  Future<void> _onTaskUpdate(_ModelTaskUpdated event, Emitter<ModelDownloadState> emit) async {
    final update = event.update;
    if (update is TaskProgressUpdate) {
      emit(state.copyWith(progress: update.progress.clamp(0, 1), phase: ModelInstallPhase.downloading));
      return;
    }
    if (update is! TaskStatusUpdate) return;

    switch (update.status) {
      case TaskStatus.complete:
        final manifest = _pendingManifest;
        if (manifest == null) return;
        emit(state.copyWith(phase: ModelInstallPhase.verifying, progress: 1));
        try {
          final staging = await ModelStore().stagingDir();
          final archive = File(p.join(staging.path, 'makhzan-${manifest.version}.tar.gz'));
          emit(state.copyWith(phase: ModelInstallPhase.installing));
          final installed = await _service.installFromArchive(
            archive: archive,
            manifest: manifest,
          );
          _activeTask = null;
          emit(
            state.copyWith(
              phase: ModelInstallPhase.ready,
              installed: installed,
              progress: 1,
              clearAvailableUpdate: true,
              clearError: true,
            ),
          );
        } catch (e) {
          emit(state.copyWith(phase: ModelInstallPhase.failed, error: e.toString()));
        }
      case TaskStatus.failed:
      case TaskStatus.notFound:
        emit(
          state.copyWith(
            phase: ModelInstallPhase.failed,
            error: update.exception?.toString() ?? 'Download failed',
          ),
        );
      case TaskStatus.canceled:
        emit(state.copyWith(phase: ModelInstallPhase.idle, progress: 0, paused: false));
      case TaskStatus.paused:
        emit(state.copyWith(paused: true));
      default:
        break;
    }
  }

  Future<int?> _freeBytes(Directory dir) => _service.store.freeBytes(dir);

  @override
  Future<void> close() async {
    await _updatesSub?.cancel();
    return super.close();
  }
}
