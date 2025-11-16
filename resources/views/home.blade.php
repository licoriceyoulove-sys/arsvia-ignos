<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>Ignos</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body class="antialiased">
    {{-- React がここに描画される --}}
    <div id="root"></div>
<script>
  window.Ignos = {
    userId: {{ session('uid') }},
    name: @json(session('name')),
  };
</script>
    {{-- Vite (React) のバンドルを読み込む --}}
@vite(['resources/css/app.css', 'resources/js/main.tsx'])
</body>
</html>

