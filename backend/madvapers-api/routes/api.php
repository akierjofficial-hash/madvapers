<?php

use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductVariantController;
use App\Http\Controllers\Api\PriceController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LedgerController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\TransferController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PublicCatalogController;
use App\Http\Controllers\Api\PublicBranchController;
use App\Http\Controllers\Api\PublicReviewController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\AuditEventController;
use App\Http\Controllers\Api\StaffAttendanceController;
use App\Http\Controllers\Api\PushSubscriptionController;

// Health
Route::get('/health', [HealthController::class, 'index']);
Route::get('/health/live', [HealthController::class, 'live']);
Route::get('/health/ready', [HealthController::class, 'ready']);

// Public auth
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware(['web', 'throttle:login', 'trusted.origin']);
Route::get('/auth/csrf-token', [AuthController::class, 'csrfToken'])->middleware(['web', 'throttle:public-api']);

Route::middleware(['throttle:public-api'])->group(function () {
    Route::get('/public/products', [PublicCatalogController::class, 'index']);
    Route::get('/public/products/{variant}', [PublicCatalogController::class, 'show']);
    Route::get('/public/branches', [PublicBranchController::class, 'index']);
    Route::get('/public/reviews', [PublicReviewController::class, 'index']);
    Route::post('/public/reviews', [PublicReviewController::class, 'store'])
        ->middleware('throttle:review-submit')
        ->withoutMiddleware([EnsureFrontendRequestsAreStateful::class]);
});

// Protected routes
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {

    // Auth
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->middleware('perm:USER_VIEW');
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->middleware('perm:USER_VIEW');
    Route::get('/audit/events', [AuditEventController::class, 'index'])->middleware('perm:AUDIT_VIEW');

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->middleware('perm:USER_VIEW');
    Route::get('/dashboard/approval-queue', [DashboardController::class, 'approvalQueue'])->middleware('perm:USER_VIEW');
    Route::get('/dashboard/kpi-details', [DashboardController::class, 'kpiDetails'])->middleware('perm:USER_VIEW');

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index'])->middleware('perm:INVENTORY_VIEW');
    Route::get('/ledger', [LedgerController::class, 'index'])->middleware('perm:LEDGER_VIEW');

    // Branches
    Route::get('/branches', [BranchController::class, 'index'])->middleware('perm:BRANCH_VIEW');
    Route::get('/branches/{branch}', [BranchController::class, 'show'])->middleware('perm:BRANCH_VIEW');
    Route::post('/branches', [BranchController::class, 'store'])->middleware('perm:BRANCH_MANAGE');
    Route::put('/branches/{branch}', [BranchController::class, 'update'])->middleware('perm:BRANCH_MANAGE');
    Route::delete('/branches/{branch}', [BranchController::class, 'destroy'])->middleware('perm:BRANCH_MANAGE');

    // Roles + Users (Admin)
    Route::get('/roles', [RoleController::class, 'index'])->middleware('perm:ROLE_VIEW');
    Route::get('/users', [UserController::class, 'index'])->middleware('perm:USER_VIEW');
    Route::post('/users', [UserController::class, 'store'])->middleware('perm:USER_CREATE');
    Route::put('/users/{user}', [UserController::class, 'update'])->middleware('perm:USER_UPDATE');
    Route::post('/users/{user}/password', [UserController::class, 'setPassword'])->middleware('perm:USER_UPDATE');
    Route::post('/users/{user}/disable', [UserController::class, 'disable'])->middleware('perm:USER_DISABLE');
    Route::post('/users/{user}/enable', [UserController::class, 'enable'])->middleware('perm:USER_DISABLE');

    // Staff Attendance
    Route::get('/staff-attendance', [StaffAttendanceController::class, 'index'])->middleware('perm:STAFF_ATTENDANCE_VIEW');
    Route::post('/staff-attendance/time-in', [StaffAttendanceController::class, 'requestTimeIn'])->middleware('perm:STAFF_ATTENDANCE_CLOCK');
    Route::post('/staff-attendance/time-out', [StaffAttendanceController::class, 'requestTimeOut'])
        ->middleware(['perm:STAFF_ATTENDANCE_CLOCK', 'throttle:sensitive-actions']);
    Route::post('/staff-attendance/{attendance}/approve', [StaffAttendanceController::class, 'approve'])
        ->middleware(['perm:STAFF_ATTENDANCE_APPROVE', 'throttle:sensitive-actions']);
    Route::post('/staff-attendance/{attendance}/reject', [StaffAttendanceController::class, 'reject'])
        ->middleware(['perm:STAFF_ATTENDANCE_APPROVE', 'throttle:sensitive-actions']);
    Route::post('/staff-attendance/{attendance}/close', [StaffAttendanceController::class, 'close'])
        ->middleware(['perm:STAFF_ATTENDANCE_APPROVE', 'throttle:sensitive-actions']);

    // Products
    Route::get('/products', [ProductController::class, 'index'])->middleware('perm:PRODUCT_VIEW');
    Route::get('/products/{product}', [ProductController::class, 'show'])->middleware('perm:PRODUCT_VIEW');
    Route::post('/products', [ProductController::class, 'store'])->middleware('perm:PRODUCT_CREATE');
    Route::put('/products/{product}', [ProductController::class, 'update'])->middleware('perm:PRODUCT_UPDATE');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->middleware('perm:PRODUCT_DISABLE');
    Route::post('/products/{product}/enable', [ProductController::class, 'enable'])->middleware('perm:PRODUCT_DISABLE');
    Route::delete('/products/{product}/purge', [ProductController::class, 'purge'])->middleware('perm:PRODUCT_DELETE');

    // Variants
    Route::get('/variants', [ProductVariantController::class, 'index'])->middleware('perm:PRODUCT_VIEW');
    Route::get('/variants/{variant}', [ProductVariantController::class, 'show'])->middleware('perm:PRODUCT_VIEW');
    Route::post('/variants', [ProductVariantController::class, 'store'])->middleware('perm:PRODUCT_CREATE');
    Route::put('/variants/{variant}', [ProductVariantController::class, 'update'])->middleware('perm:PRODUCT_UPDATE');
    Route::delete('/variants/{variant}', [ProductVariantController::class, 'destroy'])->middleware('perm:PRODUCT_DISABLE');
    Route::post('/variants/{variant}/enable', [ProductVariantController::class, 'enable'])->middleware('perm:PRODUCT_DISABLE');

    // permanent delete (safe purge)
    Route::delete('/variants/{variant}/purge', [ProductVariantController::class, 'purge'])->middleware('perm:PRODUCT_DELETE');

    // Price
    Route::post('/variants/{variant}/price', [PriceController::class, 'setVariantPrice'])->middleware('perm:PRICE_PROPOSE');

    // Brands
    Route::get('/brands', [BrandController::class, 'index'])->middleware('perm:PRODUCT_VIEW');
    Route::get('/brands/{brand}', [BrandController::class, 'show'])->middleware('perm:PRODUCT_VIEW');
    Route::post('/brands', [BrandController::class, 'store'])->middleware('perm:PRODUCT_CREATE');
    Route::put('/brands/{brand}', [BrandController::class, 'update'])->middleware('perm:PRODUCT_UPDATE');
    Route::delete('/brands/{brand}', [BrandController::class, 'destroy'])->middleware('perm:PRODUCT_DISABLE');

    // Categories
    Route::get('/categories', [CategoryController::class, 'index'])->middleware('perm:PRODUCT_VIEW');
    Route::get('/categories/{category}', [CategoryController::class, 'show'])->middleware('perm:PRODUCT_VIEW');
    Route::post('/categories', [CategoryController::class, 'store'])->middleware('perm:PRODUCT_CREATE');
    Route::put('/categories/{category}', [CategoryController::class, 'update'])->middleware('perm:PRODUCT_UPDATE');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware('perm:PRODUCT_DISABLE');

    // Adjustments
    Route::get('/adjustments', [StockAdjustmentController::class, 'index'])->middleware('perm:ADJUSTMENT_VIEW');
    Route::post('/adjustments', [StockAdjustmentController::class, 'store'])->middleware('perm:ADJUSTMENT_CREATE');
    Route::get('/adjustments/{adjustment}', [StockAdjustmentController::class, 'show'])->middleware('perm:ADJUSTMENT_VIEW');
    Route::post('/adjustments/{adjustment}/submit', [StockAdjustmentController::class, 'submit'])->middleware('perm:ADJUSTMENT_SUBMIT');
    Route::post('/adjustments/{adjustment}/approve', [StockAdjustmentController::class, 'approve'])
        ->middleware(['perm:ADJUSTMENT_APPROVE', 'throttle:sensitive-actions']);
    Route::post('/adjustments/{adjustment}/post', [StockAdjustmentController::class, 'post'])
        ->middleware(['perm:ADJUSTMENT_POST', 'throttle:sensitive-actions']);

    // Transfers
    Route::get('/transfers', [TransferController::class, 'index'])->middleware('perm:TRANSFER_VIEW');
    Route::get('/transfers/branch-options', [TransferController::class, 'branchOptions'])->middleware('perm:TRANSFER_VIEW');
    Route::get('/transfers/{transfer}', [TransferController::class, 'show'])->middleware('perm:TRANSFER_VIEW');
    Route::post('/transfers', [TransferController::class, 'store'])->middleware('perm:TRANSFER_CREATE');
    Route::put('/transfers/{transfer}', [TransferController::class, 'update'])->middleware('perm:TRANSFER_CREATE');
    Route::post('/transfers/{transfer}/request', [TransferController::class, 'requestTransfer'])->middleware('perm:TRANSFER_CREATE');
    Route::post('/transfers/{transfer}/approve', [TransferController::class, 'approve'])
        ->middleware(['perm:TRANSFER_APPROVE', 'throttle:sensitive-actions']);
    Route::post('/transfers/{transfer}/dispatch', [TransferController::class, 'dispatch'])
        ->middleware(['perm:TRANSFER_DISPATCH', 'throttle:sensitive-actions']);
    Route::post('/transfers/{transfer}/receive', [TransferController::class, 'receive'])
        ->middleware(['perm:TRANSFER_RECEIVE', 'throttle:sensitive-actions']);
    Route::post('/transfers/{transfer}/cancel', [TransferController::class, 'cancel'])
        ->middleware(['perm:TRANSFER_CREATE', 'throttle:sensitive-actions']);

    // Suppliers (CRUD)
    Route::get('/suppliers', [SupplierController::class, 'index'])->middleware('perm:SUPPLIER_VIEW');
    Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('perm:SUPPLIER_MANAGE');
    Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('perm:SUPPLIER_MANAGE');
    Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('perm:SUPPLIER_MANAGE');

    // Purchase Orders
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])->middleware('perm:PO_VIEW');
    Route::get('/purchase-orders/{po}', [PurchaseOrderController::class, 'show'])->middleware('perm:PO_VIEW');
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->middleware('perm:PO_CREATE');
    Route::post('/purchase-orders/{po}/submit', [PurchaseOrderController::class, 'submit'])->middleware('perm:PO_CREATE');
    Route::post('/purchase-orders/{po}/approve', [PurchaseOrderController::class, 'approve'])
        ->middleware(['perm:PO_APPROVE', 'throttle:sensitive-actions']);
    Route::post('/purchase-orders/{po}/receive', [PurchaseOrderController::class, 'receive'])
        ->middleware(['perm:PO_RECEIVE', 'throttle:sensitive-actions']);
    Route::post('/purchase-orders/{po}/cancel', [PurchaseOrderController::class, 'cancel'])
        ->middleware(['perm:PO_CREATE', 'throttle:sensitive-actions']);

    // Sales / Cashier
    Route::get('/sales', [SalesController::class, 'index'])->middleware('perm:SALES_VIEW');
    Route::get('/sales/{sale}', [SalesController::class, 'show'])->middleware('perm:SALES_VIEW');
    Route::post('/sales', [SalesController::class, 'store'])->middleware('perm:SALES_CREATE');
    Route::post('/sales/{sale}/post', [SalesController::class, 'post'])->middleware('perm:SALES_POST');
    Route::post('/sales/{sale}/void-request', [SalesController::class, 'requestVoid'])
        ->middleware(['perm:SALES_VOID_REQUEST', 'throttle:sensitive-actions']);
    Route::post('/sales/{sale}/void-approve', [SalesController::class, 'approveVoid'])
        ->middleware(['perm:SALES_VOID', 'throttle:sensitive-actions']);
    Route::post('/sales/{sale}/void-reject', [SalesController::class, 'rejectVoid'])
        ->middleware(['perm:SALES_VOID', 'throttle:sensitive-actions']);
    Route::post('/sales/{sale}/void', [SalesController::class, 'void'])
        ->middleware(['perm:SALES_VOID', 'throttle:sensitive-actions']);
    Route::post('/sales/{sale}/payments', [SalesController::class, 'addPayment'])
        ->middleware(['perm:SALES_PAYMENT', 'throttle:sensitive-actions']);

    // Expenses
    Route::get('/expenses', [ExpenseController::class, 'index'])->middleware('perm:EXPENSE_VIEW');
    Route::get('/expenses/{expense}', [ExpenseController::class, 'show'])->middleware('perm:EXPENSE_VIEW');
    Route::post('/expenses', [ExpenseController::class, 'store'])->middleware('perm:EXPENSE_CREATE');
    Route::put('/expenses/{expense}', [ExpenseController::class, 'update'])->middleware('perm:EXPENSE_UPDATE');
    Route::post('/expenses/{expense}/void', [ExpenseController::class, 'void'])
        ->middleware(['perm:EXPENSE_VOID', 'throttle:sensitive-actions']);
});
