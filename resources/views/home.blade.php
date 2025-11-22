<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>Ignos</title>
        {{-- タブのアイコン --}}
    <link rel="icon" href="{{ asset('favicon.ico') }}">

    {{-- iOS ホーム画面用アイコン --}}
    <link rel="apple-touch-icon" href="{{ asset('icons/icon-192.png') }}">

    {{-- PWA manifest（後述） --}}
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">

    <meta name="theme-color" content="#ffffffff">
    @vite('resources/js/main.tsx')
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body class="antialiased">
    {{-- React がここに描画される --}}
    <div id="root"></div>
<script>
  window.Ignos = {
    userId: {{ session('uid') }},
    name: @json(session('name')),
    ignosId: @json(optional($user)->ignos_id),
  };
</script>
    {{-- Vite (React) のバンドルを読み込む --}}
@vite(['resources/css/app.css', 'resources/js/main.tsx'])
</body>
</html>

