import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../features/handoff/presentation/settings_page.dart';
import '../features/model_manager/bloc/model_download_bloc.dart';
import '../features/model_manager/presentation/model_setup_page.dart';
import '../features/recorder/presentation/record_page.dart';
import '../features/transcription/presentation/review_page.dart';

/// Rebuilds redirects when the model install state changes.
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

GoRouter createRouter({
  required ModelDownloadBloc modelBloc,
  required Listenable refreshListenable,
}) {
  return GoRouter(
    initialLocation: '/setup',
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final modelState = modelBloc.state;
      final goingSetup = state.matchedLocation == '/setup';
      if (!modelState.isReady && !goingSetup) return '/setup';
      if (modelState.isReady && goingSetup) return '/record';
      return null;
    },
    routes: [
      GoRoute(
        path: '/setup',
        builder: (context, state) => const ModelSetupPage(),
      ),
      GoRoute(
        path: '/record',
        builder: (context, state) => const RecordPage(),
      ),
      GoRoute(
        path: '/review',
        builder: (context, state) => const ReviewPage(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsPage(),
      ),
    ],
  );
}
