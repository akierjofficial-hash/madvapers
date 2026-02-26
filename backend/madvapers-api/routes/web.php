<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return 'WEB OK - MAD VAPERS';
});

Route::get('/health', function () {
    return response()->json(['where' => 'web.php', 'status' => 'ok']);
});
