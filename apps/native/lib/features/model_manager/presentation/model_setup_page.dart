import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart';

import '../bloc/model_download_bloc.dart';
import '../data/model_download_service.dart';

class ModelSetupPage extends StatelessWidget {
  const ModelSetupPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: BlocBuilder<ModelDownloadBloc, ModelDownloadState>(
          builder: (context, state) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Makhzan').h2,
                const SizedBox(height: 8),
                const Text(
                  'Download the local Kashmiri speech model once. '
                  'Audio never leaves this device.',
                ).muted,
                const SizedBox(height: 24),
                _StatusCard(state: state),
                const SizedBox(height: 16),
                if (state.phase == ModelInstallPhase.downloading ||
                    state.phase == ModelInstallPhase.verifying ||
                    state.phase == ModelInstallPhase.installing)
                  Progress(progress: state.progress),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (!state.isReady)
                      Button.primary(
                        onPressed: state.phase == ModelInstallPhase.downloading
                            ? null
                            : () => context.read<ModelDownloadBloc>().add(
                                  const ModelDownloadRequested(wifiOnly: true),
                                ),
                        child: const Text('Download model'),
                      ),
                    if (state.phase == ModelInstallPhase.downloading && !state.paused)
                      Button.outline(
                        onPressed: () => context
                            .read<ModelDownloadBloc>()
                            .add(const ModelDownloadPaused()),
                        child: const Text('Pause'),
                      ),
                    if (state.paused)
                      Button.outline(
                        onPressed: () => context
                            .read<ModelDownloadBloc>()
                            .add(const ModelDownloadResumed()),
                        child: const Text('Resume'),
                      ),
                    if (state.phase == ModelInstallPhase.downloading)
                      Button.outline(
                        onPressed: () => context
                            .read<ModelDownloadBloc>()
                            .add(const ModelDownloadCancelled()),
                        child: const Text('Cancel'),
                      ),
                    if (state.phase == ModelInstallPhase.failed)
                      Button.outline(
                        onPressed: () => context
                            .read<ModelDownloadBloc>()
                            .add(const ModelDownloadRetried()),
                        child: const Text('Retry'),
                      ),
                    Button.ghost(
                      onPressed: () => context
                          .read<ModelDownloadBloc>()
                          .add(const ModelUpdateCheckRequested()),
                      child: const Text('Check for updates'),
                    ),
                  ],
                ),
                if (state.error != null) ...[
                  const SizedBox(height: 16),
                  Text(state.error!, style: const TextStyle(color: Colors.red)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.state});
  final ModelDownloadState state;

  @override
  Widget build(BuildContext context) {
    final label = switch (state.phase) {
      ModelInstallPhase.idle => 'Model not installed',
      ModelInstallPhase.checking => 'Checking…',
      ModelInstallPhase.downloading => state.paused
          ? 'Paused (${(state.progress * 100).toStringAsFixed(0)}%)'
          : 'Downloading… ${(state.progress * 100).toStringAsFixed(0)}%',
      ModelInstallPhase.verifying => 'Verifying checksums…',
      ModelInstallPhase.installing => 'Installing…',
      ModelInstallPhase.ready => 'Ready · v${state.installed?.version ?? "?"}',
      ModelInstallPhase.failed => 'Failed',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label).semiBold,
            if (state.availableUpdate != null) ...[
              const SizedBox(height: 8),
              Text('Update available: v${state.availableUpdate!.version}'),
              const SizedBox(height: 8),
              Button.secondary(
                onPressed: () => context.read<ModelDownloadBloc>().add(
                      const ModelDownloadRequested(wifiOnly: true),
                    ),
                child: const Text('Update now'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
