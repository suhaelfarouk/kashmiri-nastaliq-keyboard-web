import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:makhzan/features/transcription/bloc/transcription_bloc.dart';
import 'package:makhzan/features/transcription/data/ctc_inference_service.dart';
import 'package:mocktail/mocktail.dart';

class _MockInference extends Mock implements CtcInferenceService {}

void main() {
  late _MockInference inference;

  setUp(() {
    inference = _MockInference();
    when(() => inference.dispose()).thenAnswer((_) async {});
  });

  blocTest<TranscriptionBloc, TranscriptionState>(
    'edits update transcript text',
    build: () => TranscriptionBloc(inference),
    act: (bloc) => bloc.add(const TranscriptionTextEdited('سلام')),
    expect: () => [
      isA<TranscriptionState>()
          .having((s) => s.text, 'text', 'سلام')
          .having((s) => s.status, 'status', TranscriptionStatus.ready),
    ],
  );

  blocTest<TranscriptionBloc, TranscriptionState>(
    'clears transcript and resets status',
    build: () => TranscriptionBloc(inference),
    seed: () => const TranscriptionState(
      status: TranscriptionStatus.ready,
      text: 'hello',
      modelVersion: '1',
    ),
    act: (bloc) => bloc.add(const TranscriptionCleared()),
    expect: () => [
      isA<TranscriptionState>()
          .having((s) => s.text, 'text', '')
          .having((s) => s.status, 'status', TranscriptionStatus.idle)
          .having((s) => s.modelVersion, 'modelVersion', '1'),
    ],
  );
}
