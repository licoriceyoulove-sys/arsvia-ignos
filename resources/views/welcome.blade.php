<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ignos</title>
          {{-- タブのアイコン --}}
    <link rel="icon" href="{{ asset('favicon.ico') }}">

    {{-- iOS ホーム画面用アイコン --}}
    <link rel="apple-touch-icon" href="{{ asset('icons/icon-192.png') }}">

    {{-- PWA manifest（後述） --}}
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">

    <meta name="theme-color" content="#ffffffff">
  @viteReactRefresh
  @vite('resources/js/main.tsx')
</head>
<body>
  <div id="app"></div>
</body>
</html>
