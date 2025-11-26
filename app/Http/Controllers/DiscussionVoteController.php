<?php

namespace App\Http\Controllers;

use App\Models\DiscussionOpinion;
use App\Models\DiscussionVote;
use Illuminate\Http\Request;

class DiscussionVoteController extends Controller
{
    public function store(Request $request, DiscussionOpinion $opinion)
    {
        $user = $request->user();

        $data = $request->validate([
            'vote' => 'required|in:agree,disagree,pass',
        ]);

        DiscussionVote::updateOrCreate(
            [
                'opinion_id' => $opinion->id,
                'user_id'    => $user->id,
            ],
            [
                'vote' => $data['vote'],
            ]
        );

        // フロント側では直後に /discussions/{id} を再取得する想定
        return response()->json(['ok' => true]);
    }
}
