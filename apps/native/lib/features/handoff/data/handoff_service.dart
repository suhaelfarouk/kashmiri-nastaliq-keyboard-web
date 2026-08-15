import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';

class HandoffService {
  Future<void> copyAndOpenEditor(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      throw StateError('Nothing to send — transcript is empty');
    }
    await Clipboard.setData(ClipboardData(text: trimmed));
    final uri = Uri.parse(AppConfig.editorHandoffUrl);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      throw StateError('Copied, but could not open the editor');
    }
  }
}
