<?php

namespace App\Http\Controllers;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PDOException;
use Throwable;

abstract class Controller
{
    /**
     * Wrap a transaction and retry once or twice for deadlock/serialization failures.
     */
    protected function transactionWithRetry(callable $callback, int $maxAttempts = 3, int $baseDelayMs = 50)
    {
        $attempt = 1;

        while (true) {
            try {
                return DB::transaction($callback);
            } catch (Throwable $exception) {
                if (
                    $attempt >= $maxAttempts
                    || !$this->isRetryableTransactionException($exception)
                ) {
                    throw $exception;
                }

                $delayMs = ($baseDelayMs * $attempt) + random_int(0, $baseDelayMs);
                usleep($delayMs * 1000);
                $attempt++;
            }
        }
    }

    private function isRetryableTransactionException(Throwable $exception): bool
    {
        $sqlState = null;
        $driverCode = null;

        if ($exception instanceof QueryException) {
            $errorInfo = $exception->errorInfo;
            if (is_array($errorInfo)) {
                $sqlState = isset($errorInfo[0]) ? (string) $errorInfo[0] : null;
                $driverCode = isset($errorInfo[1]) ? (string) $errorInfo[1] : null;
            }
        }

        if ($exception instanceof PDOException) {
            $errorInfo = $exception->errorInfo ?? null;
            if (is_array($errorInfo)) {
                $sqlState = $sqlState ?? (isset($errorInfo[0]) ? (string) $errorInfo[0] : null);
                $driverCode = $driverCode ?? (isset($errorInfo[1]) ? (string) $errorInfo[1] : null);
            }
        }

        $exceptionCode = (string) $exception->getCode();

        if (in_array($sqlState, ['40P01', '40001'], true)) {
            return true;
        }

        if (in_array($driverCode, ['1213', '1205'], true)) {
            return true;
        }

        if (in_array($exceptionCode, ['40P01', '40001', '1213', '1205'], true)) {
            return true;
        }

        $message = strtolower($exception->getMessage());

        return str_contains($message, 'deadlock')
            || str_contains($message, 'serialization failure')
            || str_contains($message, 'lock wait timeout');
    }
}
