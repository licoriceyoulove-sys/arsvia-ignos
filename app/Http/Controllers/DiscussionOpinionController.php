<?php

namespace App\Http\Controllers;

use App\Models\Discussion;
use App\Models\DiscussionOpinion;
use Illuminate\Http\Request;

class DiscussionOpinionController extends Controller
{
    public function store(Request $request, Discussion $discussion)
    {
        $user = $request->user();

        $data = $request->validate([
            'body' => 'required|string',
        ]);

        $opinion = DiscussionOpinion::create([
            'discussion_id' => $discussion->id,
            'user_id'       => $user->id,
            'body'          => $data['body'],
        ]);

        return response()->json([
            'id' => $opinion->id,
            'body' => $opinion->body,
            'author_display_name' => $user->display_name ?? null,
            'author_ignos_id' => $user->ignos_id ?? null,
            'created_at' => $opinion->created_at->toIso8601String(),
            'stats' => [
                'visible'  => false,
                'agree'    => 0,
                'disagree' => 0,
                'pass'     => 0,
                'total'    => 0,
                'my_vote'  => null,
            ],
        ], 201);
    }
}
