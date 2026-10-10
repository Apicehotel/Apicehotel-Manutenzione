import 'package:flutter/material.dart';

void main() => runApp(const RandAppExperiment());

enum RandSection { operativita, planning, home, task, randai }
enum LayoutMode { piccolo, normale, grande }

class RandAppExperiment extends StatelessWidget {
  const RandAppExperiment({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'RandApp • Flutter Lab',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF255D71)),
        ),
        home: const RandShell(),
      );
}

class RandShell extends StatefulWidget {
  const RandShell({super.key});
  @override
  State<RandShell> createState() => _RandShellState();
}

class _RandShellState extends State<RandShell> {
  RandSection selected = RandSection.home;
  LayoutMode? overrideMode;
  bool inStruttura = false;
  final TextEditingController chatController = TextEditingController();
  final List<String> chatMessages = ['Ciao! Questa è una demo locale di RandAI.'];

  @override
  void dispose() {
    chatController.dispose();
    super.dispose();
  }

  LayoutMode activeMode(double width) =>
      overrideMode ?? (width < 600 ? LayoutMode.piccolo : width < 1100 ? LayoutMode.normale : LayoutMode.grande);

  String label(RandSection section) => switch (section) {
        RandSection.operativita => 'Operatività',
        RandSection.planning => 'Planning',
        RandSection.home => 'Home',
        RandSection.task => 'Task',
        RandSection.randai => 'RandAI',
      };

  IconData symbol(RandSection section) => switch (section) {
        RandSection.operativita => Icons.handyman_outlined,
        RandSection.planning => Icons.calendar_month_outlined,
        RandSection.home => Icons.home_outlined,
        RandSection.task => Icons.checklist_outlined,
        RandSection.randai => Icons.chat_bubble_outline,
      };

  void navigate(RandSection section) => setState(() => selected = section);

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, bounds) {
          final mode = activeMode(bounds.maxWidth);
          final mobile = mode == LayoutMode.piccolo;
          return Scaffold(
            appBar: AppBar(
              title: Text('RandApp  ·  ${label(selected)}'),
              actions: [
                PopupMenuButton<LayoutMode?>(
                  tooltip: 'Template layout',
                  onSelected: (value) => setState(() => overrideMode = value),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: null, child: Text('Layout automatico')),
                    PopupMenuItem(value: LayoutMode.piccolo, child: Text('Piccolo')),
                    PopupMenuItem(value: LayoutMode.normale, child: Text('Normale')),
                    PopupMenuItem(value: LayoutMode.grande, child: Text('Grande')),
                  ],
                  icon: const Icon(Icons.aspect_ratio),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: CircleAvatar(child: Text('R')),
                ),
              ],
            ),
            drawer: mobile
                ? Drawer(child: SafeArea(child: Column(children: [
                    const ListTile(title: Text('RandApp • Flutter Lab')),
                    ...RandSection.values.map((s) => ListTile(
                          leading: Icon(symbol(s)),
                          title: Text(label(s)),
                          selected: s == selected,
                          onTap: () { Navigator.pop(context); navigate(s); },
                        )),
                  ])))
                : null,
            body: Row(children: [
              if (!mobile)
                NavigationRail(
                  extended: mode == LayoutMode.grande,
                  selectedIndex: RandSection.values.indexOf(selected),
                  onDestinationSelected: (i) => navigate(RandSection.values[i]),
                  destinations: [
                    for (final s in RandSection.values)
                      NavigationRailDestination(icon: Icon(symbol(s)), label: Text(label(s))),
                  ],
                ),
              Expanded(child: SafeArea(child: _content(mode))),
            ]),
            bottomNavigationBar: mobile
                ? NavigationBar(
                    selectedIndex: RandSection.values.indexOf(selected),
                    onDestinationSelected: (i) => navigate(RandSection.values[i]),
                    destinations: [
                      for (final s in RandSection.values)
                        NavigationDestination(icon: Icon(symbol(s)), label: label(s)),
                    ],
                  )
                : null,
          );
        },
      );

  Widget _content(LayoutMode mode) {
    if (selected == RandSection.randai) return _chat();
    final children = <Widget>[
      if (selected == RandSection.home) ...[
        Card(child: SwitchListTile(
          title: const Text('Sono in struttura'),
          subtitle: Text(inStruttura ? 'Presenza attiva (demo)' : 'Presenza non attiva'),
          value: inStruttura,
          onChanged: (v) => setState(() => inStruttura = v),
        )),
        const SizedBox(height: 12),
        const Text('La tua mini-scrivania', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        _cards(['Segnalazioni aperte', 'Interventi assegnati', 'Prossimo impegno'], mode),
      ],
      if (selected == RandSection.operativita) ...[
        _group('Segnalazioni', ['Camera 207 · Perdita rubinetto', 'Sala Jazz · Illuminazione', 'Camera 411 · Climatizzazione']),
        _group('Interventi', ['Verifica impianto', 'Sostituzione lampada', 'Controllo rubinetteria']),
      ],
      if (selected == RandSection.planning) ...[
        _group('Planning Sale', ['Sala Jazz · Preparazione', 'Sala Wine · Allestimento', 'Sala Meeting · Verifica']),
        _group('Planning Lavori', ['Manutenzione preventiva', 'Controllo attrezzature', 'Rifornimento office']),
      ],
      if (selected == RandSection.task) ...[
        _group('Segnalazioni', ['Controllare camera 207', 'Richiamo reception', 'Verifica lavori']),
        _group('Promemoria', ['Attrezzature', 'Ordine materiale', 'Verifica consegne']),
      ],
    ];
    return ListView(padding: EdgeInsets.all(mode == LayoutMode.piccolo ? 12 : 24), children: children);
  }

  Widget _cards(List<String> labels, LayoutMode mode) {
    final width = mode == LayoutMode.piccolo ? 160.0 : mode == LayoutMode.normale ? 230.0 : 310.0;
    return Wrap(spacing: 12, runSpacing: 12, children: [
      for (final item in labels)
        SizedBox(
          width: width,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.dashboard_outlined),
                const SizedBox(height: 12),
                Text(item, style: const TextStyle(fontWeight: FontWeight.w600)),
                const Text('Demo · nessun dato reale'),
              ]),
            ),
          ),
        ),
    ]);
  }

  Widget _group(String heading, List<String> items) => Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(heading, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
              TextButton(onPressed: () => _showDemo(heading), child: const Text('Vedi tutto')),
            ]),
            for (final item in items)
              ListTile(
                title: Text(item),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showDemo(item),
              ),
          ]),
        ),
      );

  void _showDemo(String title) => showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(title),
          content: const Text('Azione dimostrativa. Nessun dato reale è stato modificato.'),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Chiudi'))],
        ),
      );

  Widget _chat() => Column(children: [
        Expanded(child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            for (final message in chatMessages)
              Align(
                alignment: message.startsWith('Tu:') ? Alignment.centerRight : Alignment.centerLeft,
                child: Card(
                  child: Padding(padding: const EdgeInsets.all(12), child: Text(message)),
                ),
              ),
          ],
        )),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Expanded(child: TextField(
              controller: chatController,
              decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Scrivi a RandAI (demo)'),
              onSubmitted: (_) => _sendChat(),
            )),
            IconButton(onPressed: _sendChat, icon: const Icon(Icons.send)),
          ]),
        ),
      ]);

  void _sendChat() {
    final content = chatController.text.trim();
    if (content.isEmpty) return;
    setState(() {
      chatMessages.add('Tu: $content');
      chatMessages.add('RandAI demo: la chat non è collegata al backend.');
      chatController.clear();
    });
  }
}
