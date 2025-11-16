<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    /**
     * GET /login
     * ログイン画面を表示（ログイン済みなら /home へ）
     */
    public function showLogin(Request $request)
    {
        if ($request->session()->has('uid')) {
            return redirect('/home');
        }
        return view('login'); // resources/views/login.blade.php
    }

    /**
     * POST /login
     * ID/パスワードをDBと照合してホームへ遷移
     */
    public function doLogin(Request $request)
    {
        // 入力バリデーション
        $data = $request->validate([
            'login_id' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        // users テーブルから login_id で1件取得
        $user = DB::table('users')->where('login_id', $data['login_id'])->first();

        // エラーメッセージはいつも同じ（情報を漏らさないため）
        $fail = fn () =>
            back()->withErrors(['auth' => 'IDまたはパスワードが正しくありません'])->withInput();

        if (!$user) {
            return $fail();
        }

        // password_hash カラムと照合
        if (!password_verify($data['password'], $user->password_hash)) {
            return $fail();
        }

        // セッションにユーザー情報を保存
        $request->session()->put('uid', $user->id);
        $request->session()->put('name', $user->name ?? '');

        // セッションID再発行（セキュリティ対策）
        $request->session()->regenerate();

        return redirect('/home');
    }

    /**
     * POST /logout
     * セッションを破棄してログイン画面に戻る
     */
    public function logout(Request $request)
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/login');
    }
}
