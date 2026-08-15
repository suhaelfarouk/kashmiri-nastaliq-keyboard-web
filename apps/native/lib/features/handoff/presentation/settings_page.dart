import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart';

import '../../../core/config/app_config.dart';
import '../../model_manager/bloc/model_download_bloc.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      headers: [
        AppBar(
          title: const Text('Settings'),
          leading: [
            IconButton.ghost(
              icon: const Icon(RadixIcons.arrowLeft),
              onPressed: () => context.pop(),
            ),
          ],
        ),
      ],
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: BlocBuilder<ModelDownloadBloc, ModelDownloadState>(
          builder: (context, state) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Local model').semiBold,
                        const SizedBox(height: 8),
                        Text(
                          state.installed == null
                              ? 'Not installed'
                              : 'Installed v${state.installed!.version}',
                        ),
                        const SizedBox(height: 12),
                        Button.outline(
                          onPressed: () => context
                              .read<ModelDownloadBloc>()
                              .add(const ModelUpdateCheckRequested()),
                          child: const Text('Check for updates'),
                        ),
                        if (state.availableUpdate != null) ...[
                          const SizedBox(height: 8),
                          Button.primary(
                            onPressed: () => context.read<ModelDownloadBloc>().add(
                                  const ModelDownloadRequested(wifiOnly: true),
                                ),
                            child: Text('Update to v${state.availableUpdate!.version}'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Editor').semiBold,
                        const SizedBox(height: 8),
                        Text(AppConfig.editorUrl).muted,
                        const SizedBox(height: 8),
                        const Text(
                          'Speech stays on this device. Only clipboard text is '
                          'pasted into the web editor by you.',
                        ).muted,
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
