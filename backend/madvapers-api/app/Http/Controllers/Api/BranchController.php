<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\EnforcesBranchAccess;
use App\Models\Branch;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    use EnforcesBranchAccess;

    public function index(Request $request)
    {
        $includeInactive = $request->boolean('include_inactive', false)
            && $this->isPrivilegedUser($request->user());

        $q = Branch::query()->orderBy('code');

        if (!$includeInactive) {
            $q->where('is_active', true);
        }

        // Non-admin/owner users only see their assigned branch.
        $this->scopeToAssignedBranch($request, $q, 'id');

        return $q->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => ['required','string','max:20','unique:branches,code'],
            'name' => ['required','string','max:100'],
            'address' => ['nullable','string'],
            'locator' => ['nullable','string','max:255'],
            'cellphone_no' => ['nullable','string','max:40'],
            'is_active' => ['boolean'],
        ]);

        return response()->json(Branch::create($data), 201);
    }

    public function show(Request $request, Branch $branch)
    {
        $this->enforceBranchAccessOrFail($request, $branch->id, 'branch_id');
        return $branch;
    }

    public function update(Request $request, Branch $branch)
    {
        $data = $request->validate([
            'code' => ['sometimes','string','max:20','unique:branches,code,' . $branch->id],
            'name' => ['sometimes','string','max:100'],
            'address' => ['nullable','string'],
            'locator' => ['nullable','string','max:255'],
            'cellphone_no' => ['nullable','string','max:40'],
            'is_active' => ['boolean'],
        ]);

        $branch->update($data);

        return $branch;
    }

    public function destroy(Branch $branch)
    {
        // Safer than delete: deactivate branch
        $branch->update(['is_active' => false]);

        return response()->json(['status' => 'ok']);
    }
}
