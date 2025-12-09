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
        // ★ Sanctum 経由のログインユーザー
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }
        $uid = (int) $user->id;

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
            $userRow = DB::table('users')->where('id', $uid)->first();

            return response()->json([
                'id'                  => $opinion->id,
                'body'                => $opinion->body,
                'author_display_name' => $userRow->display_name ?? null,
                'author_ignos_id'     => $userRow->ignos_id ?? null,
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
            Log::error('Failed to create opinion', [
                'uid'           => $uid,
                'discussion_id' => $discussion->id,
                'error'         => $e->getMessage(),
            ]);

            return response()->json([
                'error'   => 'server_error',
                'message' => $e->getMessage(), // 原因特定できたら消してOK
            ], 500);
        }
    }
}
