import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:randapp_flutter_experiment/main.dart';

void main() {
  testWidgets('La shell parte dalla Home e mostra la presenza', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const RandAppExperiment());
    expect(find.text('Sono in struttura'), findsOneWidget);
    expect(find.text('Operatività'), findsWidgets);
    expect(find.text('Planning'), findsWidgets);
  });

  testWidgets('RandAI mostra il campo chat locale', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(const RandAppExperiment());
    await tester.tap(find.byIcon(Icons.chat_bubble_outline).last);
    await tester.pumpAndSettle();
    expect(find.text('Scrivi a RandAI (demo)'), findsOneWidget);
  });
}
