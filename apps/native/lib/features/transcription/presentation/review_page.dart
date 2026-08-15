import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart';

import '../../../core/ui/kashmiri_text.dart';
import '../../handoff/data/handoff_service.dart';
import '../bloc/transcription_bloc.dart';
import '../../recorder/bloc/recorder_bloc.dart';

class ReviewPage extends StatefulWidget {
  const ReviewPage({super.key});

  @override
  State<ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<ReviewPage> {
  late final TextEditingController _controller;
  final _handoff = HandoffService();
  String? _handoffError;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: context.read<TranscriptionBloc>().state.text);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      headers: [
        AppBar(
          title: const Text('Review'),
          leading: [
            IconButton.ghost(
              icon: const Icon(RadixIcons.arrowLeft),
              onPressed: () => context.go('/record'),
            ),
          ],
        ),
      ],
      child: BlocConsumer<TranscriptionBloc, TranscriptionState>(
        listener: (context, state) {
          if (state.text != _controller.text) {
            _controller.text = state.text;
          }
        },
        builder: (context, state) {
          final processing = state.status == TranscriptionStatus.processing ||
              state.status == TranscriptionStatus.loadingModel;
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (processing) ...[
                  const Progress(),
                  const SizedBox(height: 12),
                  const Text('Transcribing on-device…').muted,
                  const SizedBox(height: 16),
                ],
                Expanded(
                  child: KashmiriText.rtl(
                    child: TextField(
                      controller: _controller,
                      onChanged: (v) => context
                          .read<TranscriptionBloc>()
                          .add(TranscriptionTextEdited(v)),
                      placeholder: const Text('Transcript'),
                      maxLines: null,
                      style: KashmiriText.style,
                      textAlignVertical: TextAlignVertical.top,
                    ),
                  ),
                ),
                if (state.error != null) ...[
                  const SizedBox(height: 8),
                  Text(state.error!, style: const TextStyle(color: Colors.red)),
                ],
                if (_handoffError != null) ...[
                  const SizedBox(height: 8),
                  Text(_handoffError!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Button.outline(
                      onPressed: () {
                        context.read<TranscriptionBloc>().add(const TranscriptionCleared());
                        context.read<RecorderBloc>().add(const RecorderCancelled());
                        context.go('/record');
                      },
                      child: const Text('Re-record'),
                    ),
                    Button.outline(
                      onPressed: state.sourcePath == null
                          ? null
                          : () => context
                              .read<TranscriptionBloc>()
                              .add(TranscriptionRequested(state.sourcePath!)),
                      child: const Text('Retry'),
                    ),
                    Button.primary(
                      onPressed: _sending || _controller.text.trim().isEmpty
                          ? null
                          : () async {
                              final transcription = context.read<TranscriptionBloc>();
                              final recorder = context.read<RecorderBloc>();
                              setState(() {
                                _sending = true;
                                _handoffError = null;
                              });
                              try {
                                await _handoff.copyAndOpenEditor(_controller.text);
                                if (!mounted) return;
                                transcription.add(const TranscriptionCleared());
                                recorder.add(const RecorderCancelled());
                              } catch (e) {
                                if (mounted) setState(() => _handoffError = e.toString());
                              } finally {
                                if (mounted) setState(() => _sending = false);
                              }
                            },
                      child: Text(_sending ? 'Opening…' : 'Done'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Done copies the text to your clipboard and opens the web editor. '
                  'Paste there with the Paste from Makhzan button.',
                ).muted,
              ],
            ),
          );
        },
      ),
    );
  }
}
