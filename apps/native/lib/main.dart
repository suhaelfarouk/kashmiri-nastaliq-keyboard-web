import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart';

import 'app/router.dart';
import 'core/config/app_config.dart';
import 'features/model_manager/bloc/model_download_bloc.dart';
import 'features/model_manager/data/model_download_service.dart';
import 'features/recorder/bloc/recorder_bloc.dart';
import 'features/recorder/data/recorder_service.dart';
import 'features/transcription/bloc/transcription_bloc.dart';
import 'features/transcription/data/ctc_inference_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  LicenseRegistry.addLicense(_bundledFontLicenses);
  runApp(const MakhzanApp());
}

/// Noto Nastaliq Urdu ships with the app under the SIL Open Font License.
Stream<LicenseEntry> _bundledFontLicenses() async* {
  final license = await rootBundle.loadString('assets/fonts/OFL.txt');
  yield LicenseEntryWithLineBreaks(const ['Noto Nastaliq Urdu'], license);
}

class MakhzanApp extends StatefulWidget {
  const MakhzanApp({super.key});

  @override
  State<MakhzanApp> createState() => _MakhzanAppState();
}

class _MakhzanAppState extends State<MakhzanApp> {
  late final ModelDownloadBloc _modelBloc;
  late final RecorderBloc _recorderBloc;
  late final TranscriptionBloc _transcriptionBloc;
  late final GoRouterRefreshStream _routerRefresh;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _modelBloc = ModelDownloadBloc(ModelDownloadService())
      ..add(const ModelBootstrapRequested());
    _recorderBloc = RecorderBloc(RecorderService());
    _transcriptionBloc = TranscriptionBloc(CtcInferenceService());
    _routerRefresh = GoRouterRefreshStream(_modelBloc.stream);
    _router = createRouter(
      modelBloc: _modelBloc,
      refreshListenable: _routerRefresh,
    );

    _modelBloc.stream.listen((state) {
      final installed = state.installed;
      if (state.isReady && installed != null) {
        _transcriptionBloc.add(TranscriptionModelBound(installed));
      }
    });
  }

  @override
  void dispose() {
    _routerRefresh.dispose();
    _modelBloc.close();
    _recorderBloc.close();
    _transcriptionBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _modelBloc),
        BlocProvider.value(value: _recorderBloc),
        BlocProvider.value(value: _transcriptionBloc),
      ],
      child: ShadcnApp.router(
        title: AppConfig.appName,
        theme: ThemeData(
          colorScheme: ColorSchemes.lightZinc,
          radius: 0.6,
        ),
        routerConfig: _router,
      ),
    );
  }
}
