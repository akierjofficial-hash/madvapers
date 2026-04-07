<?php

use App\Models\ProductVariant;
use App\Models\StockLedger;
use App\Services\AdminPushNotificationService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Minishlink\WebPush\VAPID;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command(
    'costs:backfill-default-cost {--dry-run : Preview changes without updating} {--fallback-price : Use default_price if no positive unit_cost history exists}',
    function () {
        $dryRun = (bool) $this->option('dry-run');
        $fallbackPrice = (bool) $this->option('fallback-price');

        $query = ProductVariant::query()
            ->where(function ($w) {
                $w->whereNull('default_cost')
                    ->orWhere('default_cost', '<=', 0);
            })
            ->orderBy('id');

        $total = (clone $query)->count();
        if ($total === 0) {
            $this->info('No variants need default-cost backfill.');
            return 0;
        }

        $this->line("Scanning {$total} variant(s) with missing/zero default cost...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $updated = 0;
        $skipped = 0;
        $preview = 0;

        $query->chunkById(200, function ($variants) use (&$updated, &$skipped, &$preview, $dryRun, $fallbackPrice, $bar) {
            foreach ($variants as $variant) {
                $candidateCost = StockLedger::query()
                    ->where('product_variant_id', $variant->id)
                    ->whereNotNull('unit_cost')
                    ->where('unit_cost', '>', 0)
                    ->orderByDesc('posted_at')
                    ->orderByDesc('id')
                    ->value('unit_cost');

                $resolved = $candidateCost !== null ? (float) $candidateCost : null;
                if (($resolved === null || $resolved <= 0) && $fallbackPrice) {
                    $fallback = (float) ($variant->default_price ?? 0);
                    $resolved = $fallback > 0 ? $fallback : null;
                }

                if ($resolved === null || $resolved <= 0) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                if ($dryRun) {
                    $preview++;
                    $bar->advance();
                    continue;
                }

                $variant->default_cost = round($resolved, 2);
                $variant->save();
                $updated++;
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);

        if ($dryRun) {
            $this->info("Dry run complete. {$preview} variant(s) would be updated.");
            $this->line("Skipped: {$skipped}");
        } else {
            $this->info("Backfill complete. Updated {$updated} variant(s).");
            $this->line("Skipped: {$skipped}");
        }

        return 0;
    }
)->purpose('Backfill variant default_cost using latest positive ledger unit_cost');

Artisan::command('push:vapid-keys', function () {
    $keys = VAPID::createVapidKeys();

    $this->newLine();
    $this->info('Generated VAPID keys (save these in your backend/.env and frontend/.env):');
    $this->line('WEB_PUSH_VAPID_PUBLIC_KEY=' . $keys['publicKey']);
    $this->line('WEB_PUSH_VAPID_PRIVATE_KEY=' . $keys['privateKey']);
    $this->line('WEB_PUSH_VAPID_SUBJECT=mailto:alerts@example.com');
    $this->line('VITE_WEB_PUSH_PUBLIC_KEY=' . $keys['publicKey']);
    $this->newLine();
})->purpose('Generate VAPID keys for Web Push notifications');

Artisan::command('push:test {--message=Test approval request from Mad Vapers} {--path=/approvals}', function () {
    $message = trim((string) $this->option('message'));
    $path = trim((string) $this->option('path'));

    /** @var AdminPushNotificationService $push */
    $push = app(AdminPushNotificationService::class);
    $summary = $push->sendTestNotification(
        $message !== '' ? $message : 'Test approval request from Mad Vapers',
        [
            'type' => 'test_push',
            'entity_type' => 'system',
            'entity_id' => 0,
            'path' => $path !== '' ? $path : '/approvals',
        ]
    );

    $this->line('Push test summary:');
    $this->line('status=' . (string) ($summary['status'] ?? 'unknown'));
    $this->line('reason=' . (string) ($summary['reason'] ?? ''));
    $this->line('admins=' . (int) ($summary['admin_count'] ?? 0));
    $this->line('subscriptions=' . (int) ($summary['subscription_count'] ?? 0));
    $this->line('queued=' . (int) ($summary['queued'] ?? 0));
    $this->line('delivered=' . (int) ($summary['delivered'] ?? 0));
    $this->line('failed=' . (int) ($summary['failed'] ?? 0));
    $this->line('expired_removed=' . (int) ($summary['expired_removed'] ?? 0));
    $this->line('invalid_subscriptions=' . (int) ($summary['invalid_subscriptions'] ?? 0));
    $this->line('queue_errors=' . (int) ($summary['queue_errors'] ?? 0));
})->purpose('Send a test Web Push notification to admin devices');
