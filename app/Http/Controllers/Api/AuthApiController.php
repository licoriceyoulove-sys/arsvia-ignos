<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class AuthApiController extends Controller
{
    /**
     * POST /api/login-token
     *
     * 入力: { "login_id": "...", "password": "..." }
     * 戻り値(成功時): { "ok": true, "token": "...", "user": {...} }
     */
    public function login(Request $request)
    {
        // 1. バリデーション
        $data = $request->validate([
            'login_id' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        // 2. login_id で users テーブルを検索（既存の doLogin と同じ考え方）
        $row = DB::table('users')
            ->where('login_id', $data['login_id'])
            ->first();

        if (!$row) {
            // ID が存在しない
            return response()->json([
                'ok'      => false,
                'message' => 'IDまたはパスワードが正しくありません',
            ], 401);
        }

        // 3. password_hash カラムと照合
        if (!password_verify($data['password'], $row->password_hash)) {
            return response()->json([
                'ok'      => false,
                'message' => 'IDまたはパスワードが正しくありません',
            ], 401);
        }

        // 4. Eloquent の User モデルを取得（Sanctum のトークン発行に必要）
        $user = User::find($row->id);

        if (!$user) {
            // 想定外: users テーブルの行はあるのに、モデルが取れないケース
            return response()->json([
                'ok'      => false,
                'message' => 'ユーザー情報の取得に失敗しました',
            ], 500);
        }

        // 5. Sanctum のパーソナルアクセストークンを発行
        //    'ignos-token' はトークン名。お好きな名前でOK（後で管理しやすい名前にするとよいです）
        $plainTextToken = $user->createToken('ignos-token')->plainTextToken;

        // 6. トークンと、最低限のユーザー情報を返す
        return response()->json([
            'ok'    => true,
            'token' => $plainTextToken,
            'user'  => [
                'id'           => $user->id,
                'login_id'     => $row->login_id ?? null,
                'display_name' => $row->display_name ?? null,
                'ignos_id'     => $row->ignos_id ?? null,
            ],
        ]);
    }

    /**
     * POST /api/logout-token
     *
     * 現在使っているトークンだけ無効化する。
     * （このルートには auth:sanctum ミドルウェアを付けてください）
     */
    public function logout(Request $request)
    {
        $user = $request->user(); // トークンから認証された User モデル

        if (!$user) {
            return response()->json([
                'ok'      => false,
                'message' => '認証されていません',
            ], 401);
        }

        // 今使っているトークンだけ削除
        $token = $user->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json([
            'ok'      => true,
            'message' => 'ログアウトしました（トークンを無効化しました）',
        ]);
    }

    /**
     * （任意）POST /api/logout-all
     *
     * そのユーザーが持っている全トークンを無効化したい場合に使う。
     * 必要になったら routes/api.php にルートを足してください。
     */
    public function logoutAll(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'ok'      => false,
                'message' => '認証されていません',
            ], 401);
        }

        // そのユーザーの全トークン削除
        $user->tokens()->delete();

        return response()->json([
            'ok'      => true,
            'message' => '全てのデバイスからログアウトしました',
        ]);
    }
}
