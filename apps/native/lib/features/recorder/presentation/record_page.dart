import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart';

import '../../transcription/bloc/transcription_bloc.dart';
import '../bloc/recorder_bloc.dart';

class RecordPage extends StatelessWidget {
  const RecordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      headers: [
        AppBar(
          title: const Text('Speak Kashmiri'),
          trailing: [
            IconButton.ghost(
              icon: const Icon(RadixIcons.gear),
              onPressed: () => context.push('/settings'),
            ),
          ],
        ),
      ],
      child: BlocConsumer<RecorderBloc, RecorderState>(
        listener: (context, state) {
          if (state.status == RecorderStatus.stopped && state.path != null) {
            context.read<TranscriptionBloc>().add(TranscriptionRequested(state.path!));
            context.go('/review');
          }
        },
        builder: (context, state) {
          final recording = state.status == RecorderStatus.recording;
          final paused = state.status == RecorderStatus.paused;
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Text(_format(state.elapsed)).h2,
                const SizedBox(height: 8),
                if (state.isClipping)
                  const Text('Too loud — move farther from the mic').muted
                else if (state.isSilent && recording)
                  const Text('Listening… speak a little louder').muted
                else
                  const Text('Tap the mic and speak clearly').muted,
                const SizedBox(height: 24),
                Expanded(child: _Waveform(amplitudes: state.amplitudes)),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (recording || paused)
                      Button.outline(
                        onPressed: () => context
                            .read<RecorderBloc>()
                            .add(const RecorderCancelled()),
                        child: const Text('Cancel'),
                      ),
                    const SizedBox(width: 12),
                    Button.primary(
                      onPressed: () {
                        final bloc = context.read<RecorderBloc>();
                        if (recording) {
                          bloc.add(const RecorderPaused());
                        } else if (paused) {
                          bloc.add(const RecorderResumed());
                        } else {
                          bloc.add(const RecorderPermissionRequested());
                          bloc.add(const RecorderStarted());
                        }
                      },
                      child: Text(recording ? 'Pause' : paused ? 'Resume' : 'Record'),
                    ),
                    const SizedBox(width: 12),
                    if (recording || paused)
                      Button.secondary(
                        onPressed: () => context
                            .read<RecorderBloc>()
                            .add(const RecorderStopped()),
                        child: const Text('Done'),
                      ),
                  ],
                ),
                if (state.error != null) ...[
                  const SizedBox(height: 12),
                  Text(state.error!, style: const TextStyle(color: Colors.red)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  String _format(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

class _Waveform extends StatelessWidget {
  const _Waveform({required this.amplitudes});
  final List<double> amplitudes;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _WavePainter(amplitudes),
      child: const SizedBox.expand(),
    );
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter(this.amplitudes);
  final List<double> amplitudes;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF171717)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    if (amplitudes.isEmpty) {
      canvas.drawLine(
        Offset(0, size.height / 2),
        Offset(size.width, size.height / 2),
        paint..color = const Color(0xFFD4D4D4),
      );
      return;
    }
    final n = amplitudes.length;
    final gap = size.width / n;
    for (var i = 0; i < n; i++) {
      final h = (amplitudes[i].clamp(0.05, 1.0)) * size.height * 0.8;
      final x = i * gap + gap / 2;
      canvas.drawLine(
        Offset(x, size.height / 2 - h / 2),
        Offset(x, size.height / 2 + h / 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _WavePainter oldDelegate) =>
      oldDelegate.amplitudes != amplitudes;
}
