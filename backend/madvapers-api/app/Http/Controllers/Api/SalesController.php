<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Http\Controllers\Controller;
use App\Models\InventoryBalance;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\StockLedger;
use App\Services\AdminPushNotificationService;
use App\Services\InventoryService;
use App\Support\AuditTrail;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesController extends Controller
{
    use EnforcesBranchAccess;

    public function __construct(
        private readonly AdminPushNotificationService $adminPushNotifications
    ) {
    }

    public function index(Request $request)
    {
        $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'status' => ['nullable', 'string', 'max:30'],
            'payment_status' => ['nullable', 'string', 'max:30'],
            'void_request_status' => ['nullable', 'string', 'max:30'],
            'search' => ['nullable', 'string', 'max:120'],
            // Accept query-string booleans like "true"/"false" from frontend params.
            'include_items' => ['nullable', 'in:0,1,true,false'],
        ]);

        $driver = DB::getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';
        $textCast = in_array($driver, ['mysql', 'mariadb'], true) ? 'CHAR' : 'TEXT';
        $likeSql = $driver === 'pgsql' ? 'ILIKE' : 'LIKE';

        $q = Sale::query()
            ->with(['branch', 'cashier', 'postedBy', 'voidedBy', 'voidRequestedBy', 'voidRejectedBy'])
            ->withCount('items')
            ->withSum('items as total_qty', 'qty')
            ->orderByDesc('id');

        if (filter_var($request->input('include_items', false), FILTER_VALIDATE_BOOLEAN)) {
            $q->with([
                'items' => function ($items) {
                    $items->orderBy('id');
                },
                'items.variant.product',
            ]);
        }

        $this->scopeToAssignedBranch($request, $q, 'branch_id');

        if ($request->filled('branch_id')) {
            $branchId = $request->integer('branch_id');
            $this->enforceBranchAccessOrFail($request, $branchId);
            $q->where('branch_id', $branchId);
        }

        if ($request->filled('status')) {
            $q->where('status', strtoupper((string) $request->input('status')));
        }

        if ($request->filled('payment_status')) {
            $q->where('payment_status', strtoupper((string) $request->input('payment_status')));
        }

        if ($request->filled('void_request_status')) {
            $q->where('void_request_status', strtoupper((string) $request->input('void_request_status')));
        }

        if ($request->filled('search')) {
            $term = '%' . trim((string) $request->input('search')) . '%';
            $q->where(function ($w) use ($term, $like, $likeSql, $textCast) {
                $w->where('sale_number', $like, $term)
                    ->orWhere('notes', $like, $term)
                    ->orWhereRaw("CAST(id AS {$textCast}) {$likeSql} ?", [$term]);
            });
        }

        return $q->paginate(20);
    }

    public function show(Request $request, Sale $sale)
    {
        $this->enforceBranchAccessOrFail($request, (int) $sale->branch_id);

        return $sale->load([
            'branch',
            'cashier',
            'postedBy',
            'voidedBy',
            'voidRequestedBy',
            'voidRejectedBy',
            'items.variant.product',
            'payments.receivedBy',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'notes' => ['nullable', 'string'],
            'sf_charge' => ['nullable', 'numeric', 'gte:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
            'items.*.line_discount' => ['nullable', 'numeric', 'gte:0'],
            'items.*.line_tax' => ['nullable', 'numeric', 'gte:0'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        $this->enforceBranchAccessOrFail($request, (int) $data['branch_id']);

        return $this->transactionWithRetry(function () use ($request, $data) {
            $sale = Sale::create([
                'branch_id' => (int) $data['branch_id'],
                'status' => 'DRAFT',
                'payment_status' => 'UNPAID',
                'void_request_status' => null,
                'cashier_user_id' => $request->user()?->id,
                'notes' => $data['notes'] ?? null,
                'subtotal' => 0,
                'discount_total' => 0,
                'tax_total' => 0,
                'sf_charge' => round((float) ($data['sf_charge'] ?? 0), 2),
                'grand_total' => 0,
                'paid_total' => 0,
                'change_given' => 0,
            ]);

            $sale->sale_number = 'SL-' . now()->format('Ymd') . '-' . str_pad((string) $sale->id, 6, '0', STR_PAD_LEFT);
            $sale->save();

            foreach ($data['items'] as $line) {
                $qty = (float) $line['qty'];
                $unitPrice = (float) $line['unit_price'];
                $lineDiscount = (float) ($line['line_discount'] ?? 0);
                $lineTax = (float) ($line['line_tax'] ?? 0);

                $lineTotal = max(0, ($qty * $unitPrice) - $lineDiscount + $lineTax);

                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_variant_id' => (int) $line['product_variant_id'],
                    'qty' => $qty,
                    'unit_price' => round($unitPrice, 2),
                    'line_discount' => round($lineDiscount, 2),
                    'line_tax' => round($lineTax, 2),
                    'line_total' => round($lineTotal, 2),
                    'notes' => $line['notes'] ?? null,
                ]);
            }

            $this->recalculateSaleTotals($sale->id);
            $this->refreshPaymentStatus($sale->fresh());

            return response()->json($sale->fresh()->load(['items.variant.product', 'branch', 'cashier']), 201);
        });
    }

    public function post(Request $request, Sale $sale)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $sale, $data) {
            $locked = $this->lockSale($sale->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'DRAFT') {
                throw ValidationException::withMessages([
                    'status' => ['Only DRAFT sales can be posted.'],
                ]);
            }
            if (strtoupper((string) ($locked->void_request_status ?? '')) === 'PENDING') {
                throw ValidationException::withMessages([
                    'void_request_status' => ['Cannot post sale while a void request is pending.'],
                ]);
            }

            $locked->load(['items.variant']);
            if ($locked->items->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => ['Sale must have at least one item before posting.'],
                ]);
            }

            $qtyByVariant = [];
            foreach ($locked->items as $item) {
                $variantId = (int) $item->product_variant_id;
                if (!isset($qtyByVariant[$variantId])) {
                    $qtyByVariant[$variantId] = 0.0;
                }
                $qtyByVariant[$variantId] += (float) $item->qty;
            }
            ksort($qtyByVariant);

            $insufficient = [];
            foreach ($qtyByVariant as $variantId => $requestedQty) {
                $balance = $this->lockInventoryBalanceRow((int) $locked->branch_id, (int) $variantId);
                $onHand = (float) ($balance->qty_on_hand ?? 0);
                $reservedByOthers = $this->reservedPostedUnpaidQtyForVariant(
                    (int) $locked->branch_id,
                    (int) $variantId,
                    (int) $locked->id
                );
                $available = $onHand - $reservedByOthers;

                if ($available + 1e-9 < $requestedQty) {
                    $insufficient[] = [
                        'product_variant_id' => (int) $variantId,
                        'required' => round((float) $requestedQty, 3),
                        'on_hand' => round($onHand, 3),
                        'reserved_qty' => round($reservedByOthers, 3),
                        'available_qty' => round(max(0.0, $available), 3),
                    ];
                }
            }

            if (!empty($insufficient)) {
                throw ValidationException::withMessages([
                    'stock' => ['Insufficient available stock to post this sale.'],
                    'details' => $insufficient,
                ]);
            }

            $locked->status = 'POSTED';
            $locked->posted_at = now();
            $locked->posted_by_user_id = $request->user()?->id;
            $locked->cashier_user_id = $locked->cashier_user_id ?? $request->user()?->id;
            if (array_key_exists('notes', $data) && trim((string) $data['notes']) !== '') {
                $locked->notes = $data['notes'];
            }
            $locked->save();

            AuditTrail::record([
                'event_type' => 'SALE_POSTED',
                'entity_type' => 'sale',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Sale posted',
                'meta' => [
                    'sale_number' => (string) ($locked->sale_number ?? ''),
                    'status' => (string) $locked->status,
                    'payment_status' => (string) $locked->payment_status,
                ],
            ]);

            $this->recalculateSaleTotals($locked->id);
            $this->refreshPaymentStatus($locked->fresh());

            return response()->json([
                'status' => 'ok',
                'sale' => $locked->fresh()->load([
                    'items.variant.product',
                    'payments',
                    'branch',
                    'cashier',
                    'postedBy',
                    'voidedBy',
                    'voidRequestedBy',
                    'voidRejectedBy',
                ]),
            ]);
        });
    }

    public function addPayment(Request $request, Sale $sale, InventoryService $inventoryService)
    {
        $data = $request->validate([
            'method' => ['required', 'string', 'max:30'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'apply_discount_to_settle' => ['nullable', 'boolean'],
            'paid_at' => ['nullable', 'date'],
            'reference_no' => ['nullable', 'string', 'max:80'],
            'client_txn_id' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $sale, $data, $inventoryService) {
            $locked = $this->lockSale($sale->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status !== 'POSTED') {
                throw ValidationException::withMessages([
                    'status' => ['Only POSTED sales can accept payments.'],
                ]);
            }
            if (strtoupper((string) ($locked->void_request_status ?? '')) === 'PENDING') {
                throw ValidationException::withMessages([
                    'void_request_status' => ['Cannot add payment while a void request is pending.'],
                ]);
            }

            $clientTxnId = trim((string) ($data['client_txn_id'] ?? ''));
            if ($clientTxnId !== '') {
                $existingPayment = SalePayment::query()
                    ->where('sale_id', $locked->id)
                    ->where('client_txn_id', $clientTxnId)
                    ->lockForUpdate()
                    ->first();

                if ($existingPayment) {
                    $this->refreshPaymentStatus($locked->fresh());
                    $refreshedExisting = $locked->fresh();

                    return response()->json([
                        'status' => 'ok',
                        'sale' => $refreshedExisting->load([
                            'items.variant.product',
                            'payments.receivedBy',
                            'branch',
                            'cashier',
                            'postedBy',
                            'voidedBy',
                            'voidRequestedBy',
                            'voidRejectedBy',
                        ]),
                    ]);
                }
            }

            $paymentAmount = round((float) $data['amount'], 2);
            $grandTotal = (float) ($locked->grand_total ?? 0);
            $paidTotal = (float) SalePayment::query()
                ->where('sale_id', $locked->id)
                ->sum('amount');
            $dueBeforePayment = max(0, $grandTotal - $paidTotal);

            if ($grandTotal <= 0 || $paidTotal + 1e-9 >= $grandTotal) {
                throw ValidationException::withMessages([
                    'amount' => ['Sale is already fully paid.'],
                ]);
            }

            $discountAppliedAmount = 0.0;
            $applyDiscountToSettle = (bool) ($data['apply_discount_to_settle'] ?? false);
            if ($applyDiscountToSettle && $paymentAmount + 1e-9 < $dueBeforePayment) {
                $targetGrandTotal = round($paidTotal + $paymentAmount, 2);

                if ($targetGrandTotal <= 0) {
                    throw ValidationException::withMessages([
                        'amount' => ['Discounted total must stay above zero.'],
                    ]);
                }

                if ($targetGrandTotal + 1e-9 < $paidTotal) {
                    throw ValidationException::withMessages([
                        'amount' => ['Discounted total cannot be below payments already recorded.'],
                    ]);
                }

                $discountAppliedAmount = round(max(0, $grandTotal - $targetGrandTotal), 2);
                if ($discountAppliedAmount > 0) {
                    $locked->discount_total = round(max(0, (float) ($locked->discount_total ?? 0) + $discountAppliedAmount), 2);
                    $locked->grand_total = round(max(0, $targetGrandTotal), 2);
                    $locked->save();
                    $grandTotal = (float) ($locked->grand_total ?? 0);
                }
            }

            $payment = SalePayment::create([
                'sale_id' => $locked->id,
                'method' => strtoupper(trim((string) $data['method'])),
                'amount' => $paymentAmount,
                'paid_at' => $data['paid_at'] ?? now(),
                'reference_no' => $data['reference_no'] ?? null,
                'client_txn_id' => $clientTxnId !== '' ? $clientTxnId : null,
                'notes' => $data['notes'] ?? null,
                'received_by_user_id' => $request->user()?->id,
            ]);

            $this->refreshPaymentStatus($locked->fresh());
            $refreshed = $locked->fresh();

            if ($refreshed->payment_status === 'PAID') {
                $this->postSaleStockOnPayment($request, $refreshed, $inventoryService, $data['notes'] ?? null);
                $refreshed = $refreshed->fresh();
            }

            $saleAudit = $this->buildSalePaymentAuditMeta($refreshed);
            $paymentAmount = round((float) $payment->amount, 2);
            $paidTotal = round((float) ($refreshed->paid_total ?? 0), 2);
            $grandTotal = round((float) ($refreshed->grand_total ?? 0), 2);
            $discountAppliedAmount = round($discountAppliedAmount, 2);

            AuditTrail::record([
                'event_type' => 'SALE_PAYMENT_ADDED',
                'entity_type' => 'sale',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => sprintf(
                    'Sale payment %.2f (paid %.2f/%.2f, qty %.3f%s)',
                    $paymentAmount,
                    $paidTotal,
                    $grandTotal,
                    (float) ($saleAudit['sale_total_qty'] ?? 0),
                    $discountAppliedAmount > 0 ? sprintf(', discount %.2f', $discountAppliedAmount) : ''
                ),
                'meta' => [
                    'sale_number' => (string) ($locked->sale_number ?? ''),
                    'payment_id' => (int) $payment->id,
                    'method' => (string) $payment->method,
                    'amount' => $paymentAmount,
                    'client_txn_id' => $payment->client_txn_id,
                    'apply_discount_to_settle' => $applyDiscountToSettle,
                    'discount_applied_amount' => $discountAppliedAmount,
                    'payment_status' => (string) ($refreshed->payment_status ?? ''),
                    'paid_total' => $paidTotal,
                    'sale_grand_total' => $grandTotal,
                    'sale_total_qty' => (float) ($saleAudit['sale_total_qty'] ?? 0),
                    'sale_item_count' => (int) ($saleAudit['sale_item_count'] ?? 0),
                    'items_sold' => $saleAudit['items_sold'] ?? [],
                ],
            ]);

            return response()->json([
                'status' => 'ok',
                'sale' => $refreshed->load([
                    'items.variant.product',
                    'payments.receivedBy',
                    'branch',
                    'cashier',
                    'postedBy',
                    'voidedBy',
                    'voidRequestedBy',
                    'voidRejectedBy',
                ]),
            ]);
        });
    }

    public function requestVoid(Request $request, Sale $sale)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        $notifyContext = [
            'sale_id' => 0,
            'branch_id' => null,
            'sale_number' => '',
        ];

        $response = $this->transactionWithRetry(function () use ($request, $sale, $data, &$notifyContext) {
            $locked = $this->lockSale($sale->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status === 'VOIDED') {
                throw ValidationException::withMessages([
                    'status' => ['Sale is already voided.'],
                ]);
            }

            if (!in_array($locked->status, ['DRAFT', 'POSTED'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Only DRAFT or POSTED sales can request void.'],
                ]);
            }

            if (strtoupper((string) ($locked->void_request_status ?? '')) === 'PENDING') {
                throw ValidationException::withMessages([
                    'void_request_status' => ['Sale already has a pending void request.'],
                ]);
            }

            $locked->void_request_status = 'PENDING';
            $locked->void_requested_at = now();
            $locked->void_requested_by_user_id = $request->user()?->id;
            $locked->void_request_notes = array_key_exists('notes', $data) ? ($data['notes'] ?? null) : null;
            $locked->void_rejected_at = null;
            $locked->void_rejected_by_user_id = null;
            $locked->void_rejection_notes = null;
            $locked->save();
            $notifyContext['sale_id'] = (int) $locked->id;
            $notifyContext['branch_id'] = (int) $locked->branch_id;
            $notifyContext['sale_number'] = (string) ($locked->sale_number ?? '');

            AuditTrail::record([
                'event_type' => 'SALE_VOID_REQUESTED',
                'entity_type' => 'sale',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Sale void requested',
                'meta' => [
                    'sale_number' => (string) ($locked->sale_number ?? ''),
                    'status' => (string) $locked->status,
                    'void_request_status' => (string) ($locked->void_request_status ?? ''),
                    'notes' => $locked->void_request_notes,
                ],
            ]);
            return response()->json([
                'status' => 'ok',
                'sale' => $locked->fresh()->load([
                    'items.variant.product',
                    'payments.receivedBy',
                    'branch',
                    'cashier',
                    'postedBy',
                    'voidedBy',
                    'voidRequestedBy',
                    'voidRejectedBy',
                ]),
            ]);
        });

        if ((int) ($notifyContext['sale_id'] ?? 0) > 0) {
            $saleNumber = trim((string) ($notifyContext['sale_number'] ?? ''));
            $label = $saleNumber !== '' ? $saleNumber : ('Sale #' . (int) $notifyContext['sale_id']);

            $this->adminPushNotifications->sendApprovalRequestNotification(
                sprintf('%s has a new void request awaiting approval.', $label),
                [
                    'type' => 'sale_void_request',
                    'entity_type' => 'sale',
                    'entity_id' => (int) $notifyContext['sale_id'],
                    'branch_id' => (int) $notifyContext['branch_id'],
                    'path' => '/sales',
                ]
            );
        }

        return $response;
    }

    public function approveVoid(Request $request, Sale $sale, InventoryService $inventoryService)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $sale, $inventoryService, $data) {
            $locked = $this->lockSale($sale->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if (strtoupper((string) ($locked->void_request_status ?? '')) !== 'PENDING') {
                throw ValidationException::withMessages([
                    'void_request_status' => ['No pending void request to approve.'],
                ]);
            }
            $this->assertVoidDecisionByDifferentUser($request, $locked, 'approve');

            $this->performVoid($request, $locked, $inventoryService, $data['notes'] ?? null);

            AuditTrail::record([
                'event_type' => 'SALE_VOID_APPROVED',
                'entity_type' => 'sale',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Sale void approved',
                'meta' => [
                    'sale_number' => (string) ($locked->sale_number ?? ''),
                    'notes' => $data['notes'] ?? null,
                ],
            ]);
            return response()->json([
                'status' => 'ok',
                'sale' => $locked->fresh()->load([
                    'items.variant.product',
                    'payments.receivedBy',
                    'branch',
                    'cashier',
                    'postedBy',
                    'voidedBy',
                    'voidRequestedBy',
                    'voidRejectedBy',
                ]),
            ]);
        });
    }

    public function rejectVoid(Request $request, Sale $sale)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $sale, $data) {
            $locked = $this->lockSale($sale->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            if ($locked->status === 'VOIDED') {
                throw ValidationException::withMessages([
                    'status' => ['Sale is already voided.'],
                ]);
            }

            if (strtoupper((string) ($locked->void_request_status ?? '')) !== 'PENDING') {
                throw ValidationException::withMessages([
                    'void_request_status' => ['No pending void request to reject.'],
                ]);
            }
            $this->assertVoidDecisionByDifferentUser($request, $locked, 'reject');

            $locked->void_request_status = 'REJECTED';
            $locked->void_rejected_at = now();
            $locked->void_rejected_by_user_id = $request->user()?->id;
            $locked->void_rejection_notes = array_key_exists('notes', $data)
                ? ($data['notes'] ?? null)
                : 'Void request rejected';
            $locked->save();

            AuditTrail::record([
                'event_type' => 'SALE_VOID_REJECTED',
                'entity_type' => 'sale',
                'entity_id' => (int) $locked->id,
                'branch_id' => (int) $locked->branch_id,
                'user_id' => $request->user()?->id,
                'summary' => 'Sale void request rejected',
                'meta' => [
                    'sale_number' => (string) ($locked->sale_number ?? ''),
                    'notes' => $locked->void_rejection_notes,
                ],
            ]);
            return response()->json([
                'status' => 'ok',
                'sale' => $locked->fresh()->load([
                    'items.variant.product',
                    'payments.receivedBy',
                    'branch',
                    'cashier',
                    'postedBy',
                    'voidedBy',
                    'voidRequestedBy',
                    'voidRejectedBy',
                ]),
            ]);
        });
    }

    public function void(Request $request, Sale $sale, InventoryService $inventoryService)
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string'],
        ]);

        return $this->transactionWithRetry(function () use ($request, $sale, $inventoryService, $data) {
            $locked = $this->lockSale($sale->id);
            $this->enforceBranchAccessOrFail($request, (int) $locked->branch_id);

            $this->performVoid($request, $locked, $inventoryService, $data['notes'] ?? null);
            return response()->json([
                'status' => 'ok',
                'sale' => $locked->fresh()->load([
                    'items.variant.product',
                    'payments.receivedBy',
                    'branch',
                    'cashier',
                    'postedBy',
                    'voidedBy',
                    'voidRequestedBy',
                    'voidRejectedBy',
                ]),
            ]);
        });
    }

    private function lockInventoryBalanceRow(int $branchId, int $variantId): InventoryBalance
    {
        $key = [
            'branch_id' => $branchId,
            'product_variant_id' => $variantId,
        ];

        $balance = InventoryBalance::query()
            ->where($key)
            ->lockForUpdate()
            ->first();

        if ($balance) {
            return $balance;
        }

        try {
            InventoryBalance::create($key + ['qty_on_hand' => 0]);
        } catch (QueryException $exception) {
            // Another transaction may have created the row first.
        }

        return InventoryBalance::query()
            ->where($key)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function reservedPostedUnpaidQtyForVariant(int $branchId, int $variantId, int $excludeSaleId): float
    {
        return (float) SaleItem::query()
            ->join('sales as s', 's.id', '=', 'sale_items.sale_id')
            ->where('s.branch_id', $branchId)
            ->where('sale_items.product_variant_id', $variantId)
            ->where('s.status', 'POSTED')
            ->where('s.payment_status', '!=', 'PAID')
            ->where('s.id', '!=', $excludeSaleId)
            ->sum('sale_items.qty');
    }

    private function postSaleStockOnPayment(
        Request $request,
        Sale $sale,
        InventoryService $inventoryService,
        ?string $notes = null
    ): void {
        $alreadyPosted = StockLedger::query()
            ->where('movement_type', 'SALE')
            ->where('ref_type', 'sales')
            ->where('ref_id', $sale->id)
            ->exists();

        if ($alreadyPosted) {
            return;
        }

        $sale->loadMissing(['items.variant']);

        if ($sale->items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => ['Sale must have at least one item before completing payment.'],
            ]);
        }

        $qtyByVariant = [];
        $itemsToPost = $sale->items
            ->sortBy(function ($item) {
                return sprintf('%010d-%010d', (int) $item->product_variant_id, (int) $item->id);
            })
            ->values();

        foreach ($itemsToPost as $item) {
            $variantId = (int) $item->product_variant_id;
            if (!isset($qtyByVariant[$variantId])) {
                $qtyByVariant[$variantId] = 0.0;
            }
            $qtyByVariant[$variantId] += (float) $item->qty;
        }
        ksort($qtyByVariant);

        $insufficient = [];
        foreach ($qtyByVariant as $variantId => $requiredQty) {
            $balance = $this->lockInventoryBalanceRow((int) $sale->branch_id, (int) $variantId);
            $onHand = (float) ($balance->qty_on_hand ?? 0);
            if ($onHand + 1e-9 < $requiredQty) {
                $insufficient[] = [
                    'product_variant_id' => (int) $variantId,
                    'required' => round((float) $requiredQty, 3),
                    'on_hand' => $onHand,
                ];
            }
        }

        if (!empty($insufficient)) {
            throw ValidationException::withMessages([
                'stock' => ['Insufficient stock to complete payment.'],
                'details' => $insufficient,
            ]);
        }

        foreach ($sale->items as $item) {
            $qty = (float) $item->qty;
            $unitCost = (float) ($item->variant?->default_cost ?? 0);
            $lineCogs = $qty * max(0, $unitCost);

            $item->unit_cost_snapshot = $unitCost > 0 ? round($unitCost, 2) : 0;
            $item->line_cogs = round($lineCogs, 2);
            $item->save();

            $inventoryService->postMovement([
                'branch_id' => $sale->branch_id,
                'product_variant_id' => $item->product_variant_id,
                'qty_delta' => -1 * $qty,
                'movement_type' => 'SALE',
                'reason_code' => 'SALE_PAYMENT',
                'ref_type' => 'sales',
                'ref_id' => $sale->id,
                'performed_by_user_id' => $request->user()?->id,
                'unit_cost' => $unitCost > 0 ? round($unitCost, 2) : null,
                'unit_price' => $item->unit_price,
                'notes' => $notes ?? 'Sale payment completed',
            ]);
        }
    }

    private function performVoid(
        Request $request,
        Sale $locked,
        InventoryService $inventoryService,
        ?string $notes = null
    ): void {
        if ($locked->status === 'VOIDED') {
            throw ValidationException::withMessages([
                'status' => ['Sale is already voided.'],
            ]);
        }

        if (!in_array($locked->status, ['DRAFT', 'POSTED'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only DRAFT or POSTED sales can be voided.'],
            ]);
        }

        if (strtoupper((string) ($locked->void_request_status ?? '')) === 'PENDING') {
            $this->assertVoidDecisionByDifferentUser($request, $locked, 'approve');
        }

        $saleLedgers = StockLedger::query()
            ->where('movement_type', 'SALE')
            ->where('ref_type', 'sales')
            ->where('ref_id', $locked->id)
            ->orderBy('product_variant_id')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $alreadyReversed = StockLedger::query()
            ->where('movement_type', 'SALE_VOID')
            ->where('ref_type', 'sales')
            ->where('ref_id', $locked->id)
            ->exists();

        if (!$alreadyReversed) {
            foreach ($saleLedgers as $entry) {
                $qtyToReverse = abs((float) ($entry->qty_delta ?? 0));
                if ($qtyToReverse <= 0) {
                    continue;
                }

                $inventoryService->postMovement([
                    'branch_id' => (int) $locked->branch_id,
                    'product_variant_id' => (int) $entry->product_variant_id,
                    'qty_delta' => $qtyToReverse,
                    'movement_type' => 'SALE_VOID',
                    'reason_code' => 'SALE_VOID',
                    'ref_type' => 'sales',
                    'ref_id' => (int) $locked->id,
                    'performed_by_user_id' => $request->user()?->id,
                    'unit_cost' => $entry->unit_cost,
                    'unit_price' => $entry->unit_price,
                    'notes' => $notes ?? 'Sale voided and stock reversed',
                ]);
            }
        }

        $hadVoidRequest = !empty($locked->void_requested_by_user_id)
            || !empty($locked->void_request_status)
            || !empty($locked->void_requested_at);

        $locked->status = 'VOIDED';
        $locked->voided_at = now();
        $locked->voided_by_user_id = $request->user()?->id;
        if ($hadVoidRequest) {
            $locked->void_request_status = 'APPROVED';
            $locked->void_rejected_at = null;
            $locked->void_rejected_by_user_id = null;
            $locked->void_rejection_notes = null;
        }

        if ($notes !== null && trim((string) $notes) !== '') {
            $locked->notes = $notes;
        }
        $locked->save();

        AuditTrail::record([
            'event_type' => 'SALE_VOIDED',
            'entity_type' => 'sale',
            'entity_id' => (int) $locked->id,
            'branch_id' => (int) $locked->branch_id,
            'user_id' => $request->user()?->id,
            'summary' => 'Sale voided',
            'meta' => [
                'sale_number' => (string) ($locked->sale_number ?? ''),
                'had_void_request' => $hadVoidRequest,
                'status' => (string) $locked->status,
                'payment_status' => (string) ($locked->payment_status ?? ''),
                'notes' => $notes,
            ],
        ]);
    }

    private function assertVoidDecisionByDifferentUser(Request $request, Sale $sale, string $action): void
    {
        $actorId = (int) ($request->user()?->id ?? 0);
        $requesterId = (int) ($sale->void_requested_by_user_id ?? 0);

        if ($actorId <= 0 || $requesterId <= 0 || $actorId !== $requesterId) {
            return;
        }

        $verb = $action === 'reject' ? 'reject' : 'approve';

        throw ValidationException::withMessages([
            'void_request_status' => ["You cannot {$verb} your own void request. Please ask another approver."],
        ]);
    }

    private function lockSale(int $saleId): Sale
    {
        return Sale::query()
            ->lockForUpdate()
            ->findOrFail($saleId);
    }

    private function recalculateSaleTotals(int $saleId): void
    {
        $sfCharge = (float) (Sale::query()->whereKey($saleId)->value('sf_charge') ?? 0);
        $sfCharge = max(0, $sfCharge);

        $itemRows = SaleItem::query()
            ->where('sale_id', $saleId)
            ->get(['qty', 'unit_price', 'line_discount', 'line_tax', 'line_total']);

        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        $grandTotal = 0.0;

        foreach ($itemRows as $item) {
            $qty = (float) ($item->qty ?? 0);
            $unitPrice = (float) ($item->unit_price ?? 0);
            $lineDiscount = (float) ($item->line_discount ?? 0);
            $lineTax = (float) ($item->line_tax ?? 0);

            $subtotal += ($qty * $unitPrice);
            $discountTotal += $lineDiscount;
            $taxTotal += $lineTax;
            $grandTotal += (float) ($item->line_total ?? 0);
        }
        $grandTotal += $sfCharge;

        Sale::query()->whereKey($saleId)->update([
            'subtotal' => round($subtotal, 2),
            'discount_total' => round($discountTotal, 2),
            'tax_total' => round($taxTotal, 2),
            'grand_total' => round($grandTotal, 2),
        ]);
    }

    private function refreshPaymentStatus(Sale $sale): void
    {
        $paidTotal = (float) SalePayment::query()->where('sale_id', $sale->id)->sum('amount');
        $grandTotal = (float) ($sale->grand_total ?? 0);

        $paymentStatus = 'UNPAID';
        if ($paidTotal > 0 && $paidTotal + 1e-9 < $grandTotal) {
            $paymentStatus = 'PARTIAL';
        }
        if ($paidTotal + 1e-9 >= $grandTotal && $grandTotal > 0) {
            $paymentStatus = 'PAID';
        }

        $changeGiven = max(0, $paidTotal - $grandTotal);

        $sale->paid_total = round($paidTotal, 2);
        $sale->change_given = round($changeGiven, 2);
        $sale->payment_status = $paymentStatus;
        $sale->save();
    }

    /**
     * @return array{
     *   sale_total_qty:float,
     *   sale_item_count:int,
     *   items_sold:array<int, array{
     *     product_variant_id:int,
     *     sku:string,
     *     product_name:string,
     *     variant_name:string,
     *     flavor:string,
     *     qty:float,
     *     unit_price:float,
     *     line_total:float
     *   }>
     * }
     */
    private function buildSalePaymentAuditMeta(Sale $sale): array
    {
        $sale->loadMissing(['items.variant.product']);

        $itemsSold = [];
        $totalQty = 0.0;

        foreach ($sale->items as $item) {
            $qty = round((float) ($item->qty ?? 0), 3);
            $unitPrice = round((float) ($item->unit_price ?? 0), 2);
            $lineTotal = round((float) ($item->line_total ?? 0), 2);

            $totalQty += $qty;
            $itemsSold[] = [
                'product_variant_id' => (int) ($item->product_variant_id ?? 0),
                'sku' => (string) ($item->variant?->sku ?? ''),
                'product_name' => (string) ($item->variant?->product?->name ?? ''),
                'variant_name' => (string) ($item->variant?->variant_name ?? ''),
                'flavor' => (string) ($item->variant?->flavor ?? ''),
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
            ];
        }

        return [
            'sale_total_qty' => round($totalQty, 3),
            'sale_item_count' => count($itemsSold),
            'items_sold' => $itemsSold,
        ];
    }

}
