<?php

return [
    'enabled' => filter_var((string) env('WEB_PUSH_ENABLED', 'true'), FILTER_VALIDATE_BOOLEAN),

    'vapid' => [
        'subject' => (string) env('WEB_PUSH_VAPID_SUBJECT', ''),
        'public_key' => (string) env('WEB_PUSH_VAPID_PUBLIC_KEY', ''),
        'private_key' => (string) env('WEB_PUSH_VAPID_PRIVATE_KEY', ''),
    ],
];

