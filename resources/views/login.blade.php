<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>ログイン</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 40px; }
        form { max-width: 320px; }
        label { display: block; margin-bottom: 8px; }
        input { width: 100%; padding: 6px 8px; margin-top: 4px; box-sizing: border-box; }
        button { margin-top: 12px; padding: 8px 12px; }
        .error { color: #b00020; margin: 8px 0; }
    </style>
</head>
<body>
    <h1>ログイン</h1>

    @if ($errors->any())
        <div class="error">
            @foreach ($errors->all() as $e)
                <div>{{ $e }}</div>
            @endforeach
        </div>
    @endif

    <form method="post" action="{{ url('/login') }}">
        @csrf
        <label>
            ID
            <input name="login_id" value="{{ old('login_id') }}" required autofocus>
        </label>
        <label>
            パスワード
            <input name="password" type="password" required>
        </label>
        <button type="submit">ログイン</button>
    </form>
</body>
</html>
