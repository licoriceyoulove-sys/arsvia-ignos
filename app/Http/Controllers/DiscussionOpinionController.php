<?php

namespace App\Http\Controllers;

use App\Models\Discussion;
use App\Models\DiscussionOpinion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DiscussionOpinionController extends Controller
{
    public function store(Request $request, Discussion $discussion)
    {
        // ① セッションからログイン中ユーザーIDを取得
        $uid = $request->session()->get('uid');

        if (!$uid) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        // ② 入力チェック
        $data = $request->validate([
            'body' => 'required|string',
        ]);

        try {
            // ③ 意見レコードを作成
            $opinion = DiscussionOpinion::create([
                'discussion_id' => $discussion->id,
                'user_id'       => $uid,
                'body'          => $data['body'],
            ]);

            // ④ 返却用に users テーブルから投稿者情報を取得
            $user = DB::table('users')->where('id', $uid)->first();

            return response()->json([
                'id'                  => $opinion->id,
                'body'                => $opinion->body,
                'author_display_name' => $user->display_name ?? null,
                'author_ignos_id'     => $user->ignos_id ?? null,
                'created_at'          => $opinion->created_at->toIso8601String(),
                'stats'               => [
                    'visible'  => false,
                    'agree'    => 0,
                    'disagree' => 0,
                    'pass'     => 0,
                    'total'    => 0,
                    'my_vote'  => null,
                ],
            ], 201);

        } catch (\Throwable $e) {
            // ⑤ ここで本当のエラー内容をログ & レスポンスに出す
            Log::error('Failed to create opinion', [
                'uid'          => $uid,
                'discussion_id'=> $discussion->id,
                'error'        => $e->getMessage(),
            ]);

            return response()->json([
                'error'   => 'server_error',
                'message' => $e->getMessage(), // ★ デバッグ用。原因特定できたら消してOK
            ], 500);
        }
    }
}
