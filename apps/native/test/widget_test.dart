import 'package:flutter_test/flutter_test.dart';
import 'package:makhzan/core/config/app_config.dart';

void main() {
  test('app config identity', () {
    expect(AppConfig.appName, 'Makhzan');
    expect(AppConfig.packageId, 'com.makhzan');
    expect(AppConfig.editorHandoffUrl.contains('from=makhzan'), isTrue);
  });
}
