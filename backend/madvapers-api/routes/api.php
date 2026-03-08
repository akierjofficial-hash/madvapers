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
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PublicCatalogController;
use App\Http\Controllers\Api\PublicBranchController;
use App\Http\Controllers\Api\PublicReviewController;
use App\Http\Controllers\Api\DashboardController;

// Health
Route::get('/health', fn () => response()->json(['where' => 'api.php', 'status' => 'ok']));

// Public auth
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

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

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->middleware('perm:USER_VIEW');
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
    Route::post('/adjustments/{adjustment}/approve', [StockAdjustmentController::class, 'approve'])->middleware('perm:ADJUSTMENT_APPROVE');
    Route::post('/adjustments/{adjustment}/post', [StockAdjustmentController::class, 'post'])->middleware('perm:ADJUSTMENT_POST');

    // Transfers
    Route::get('/transfers', [TransferController::class, 'index'])->middleware('perm:TRANSFER_VIEW');
    Route::get('/transfers/{transfer}', [TransferController::class, 'show'])->middleware('perm:TRANSFER_VIEW');
    Route::post('/transfers', [TransferController::class, 'store'])->middleware('perm:TRANSFER_CREATE');
    Route::put('/transfers/{transfer}', [TransferController::class, 'update'])->middleware('perm:TRANSFER_CREATE');
    Route::post('/transfers/{transfer}/request', [TransferController::class, 'requestTransfer'])->middleware('perm:TRANSFER_CREATE');
    Route::post('/transfers/{transfer}/approve', [TransferController::class, 'approve'])->middleware('perm:TRANSFER_APPROVE');
    Route::post('/transfers/{transfer}/dispatch', [TransferController::class, 'dispatch'])->middleware('perm:TRANSFER_DISPATCH');
    Route::post('/transfers/{transfer}/receive', [TransferController::class, 'receive'])->middleware('perm:TRANSFER_RECEIVE');
    Route::post('/transfers/{transfer}/cancel', [TransferController::class, 'cancel'])->middleware('perm:TRANSFER_CREATE');

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
    Route::post('/purchase-orders/{po}/approve', [PurchaseOrderController::class, 'approve'])->middleware('perm:PO_APPROVE');
    Route::post('/purchase-orders/{po}/receive', [PurchaseOrderController::class, 'receive'])->middleware('perm:PO_RECEIVE');
    Route::post('/purchase-orders/{po}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware('perm:PO_CREATE');
});
