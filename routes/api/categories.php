<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

Route::get('/category-larges', function () {
    try {
        return response()->json(
            DB::table('category_larges')
                ->select('id', 'name_jp', 'name_en', 'description')
                ->get()
        );
    } catch (\Throwable $e) {
        \Log::error('GET /api/category-larges failed', ['error' => $e->getMessage()]);
        return response()->json(['ok' => false, 'message' => 'category_larges query failed'], 500);
    }
});

Route::get('/category-middles', function () {
    try {
        return response()->json(
            DB::table('category_middles')
                ->where('is_active', 1)
                ->whereNull('deleted_at')
                ->select('id','large_id','code','name_jp','name_en','description')
                ->orderBy('large_id')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
        );
    } catch (\Throwable $e) {
        \Log::error('GET /api/category-middles failed', ['error' => $e->getMessage()]);
        return response()->json(['ok' => false, 'message' => 'category_middles query failed'], 500);
    }
});

Route::get('/category-smalls', function () {
    try {
        return response()->json(
            DB::table('category_smalls')
                ->where('is_active', 1)
                ->whereNull('deleted_at')
                ->select('id','middle_id','code','name_jp','name_en','description')
                ->orderBy('middle_id')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
        );
    } catch (\Throwable $e) {
        \Log::error('GET /api/category-smalls failed', ['error' => $e->getMessage()]);
        return response()->json(['ok' => false, 'message' => 'category_smalls query failed'], 500);
    }
});
