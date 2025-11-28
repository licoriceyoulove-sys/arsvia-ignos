<?php

namespace App\Http\Controllers;

use App\Models\DiscussionOpinion;
use App\Models\DiscussionVote;
use Illuminate\Http\Request;

class DiscussionVoteController extends Controller
{
    /**
     * POST /api/discussions/opinions/{opinion}/vote
     *
     * body: { vote: "agree" | "disagree" | "pass" }
     */
    public function store(Request $request, DiscussionOpinion $opinion)
    {
        // ① セッションからログインユーザーIDを取得
        $uid = $request->session()->get('uid');

        if (!$uid) {
            // ログインしていない
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        // ② vote パラメータをチェック
        $data = $request->validate([
            'vote' => 'required|string|in:agree,disagree,pass',
        ]);

        // ③ 1ユーザー1意見 1レコードにしたいので、updateOrCreate を使う
        DiscussionVote::updateOrCreate(
            [
                'opinion_id' => $opinion->id,
                'user_id'    => $uid,
            ],
            [
                'vote'       => $data['vote'],
            ]
        );

        // フロント側では、このあと fetchDiscussionDetail(id) し直して
        // 集計結果を取り直す想定なので、ここではシンプルに ok だけ返す
        return response()->json(['ok' => true]);
    }
}
