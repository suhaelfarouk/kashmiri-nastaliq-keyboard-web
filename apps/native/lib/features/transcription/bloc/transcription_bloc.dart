import 'dart:io';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/model/model_store.dart';
import '../data/ctc_inference_service.dart';

part 'transcription_event.dart';
part 'transcription_state.dart';

class TranscriptionBloc extends Bloc<TranscriptionEvent, TranscriptionState> {
  TranscriptionBloc(this._inference) : super(const TranscriptionState()) {
    on<TranscriptionModelBound>(_onBind);
    on<TranscriptionRequested>(_onTranscribe);
    on<TranscriptionTextEdited>(_onEdit);
    on<TranscriptionCleared>(_onClear);
  }

  final CtcInferenceService _inference;

  Future<void> _onBind(
    TranscriptionModelBound event,
    Emitter<TranscriptionState> emit,
  ) async {
    emit(state.copyWith(status: TranscriptionStatus.loadingModel, clearError: true));
    try {
      await _inference.load(event.model);
      emit(state.copyWith(status: TranscriptionStatus.idle, modelVersion: event.model.version));
    } catch (e) {
      emit(state.copyWith(status: TranscriptionStatus.error, error: e.toString()));
    }
  }

  Future<void> _onTranscribe(
    TranscriptionRequested event,
    Emitter<TranscriptionState> emit,
  ) async {
    emit(state.copyWith(status: TranscriptionStatus.processing, clearError: true));
    try {
      final text = await _inference.transcribeWav(event.wavPath);
      emit(
        state.copyWith(
          status: TranscriptionStatus.ready,
          text: text,
          sourcePath: event.wavPath,
        ),
      );
    } catch (e) {
      emit(state.copyWith(status: TranscriptionStatus.error, error: e.toString()));
    }
  }

  void _onEdit(TranscriptionTextEdited event, Emitter<TranscriptionState> emit) {
    emit(state.copyWith(text: event.text, status: TranscriptionStatus.ready));
  }

  Future<void> _onClear(TranscriptionCleared event, Emitter<TranscriptionState> emit) async {
    final path = state.sourcePath;
    if (path != null) {
      final file = File(path);
      if (await file.exists()) await file.delete();
    }
    emit(
      TranscriptionState(
        status: TranscriptionStatus.idle,
        modelVersion: state.modelVersion,
      ),
    );
  }

  @override
  Future<void> close() async {
    await _inference.dispose();
    return super.close();
  }
}
