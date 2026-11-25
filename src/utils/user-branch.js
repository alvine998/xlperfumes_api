function assignedBranchId(req) {
  const branchId = Number(req.user?.branchId);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
}

function isAllowedBranch(req, branchId) {
  const assignedId = assignedBranchId(req);
  return assignedId === null || Number(branchId) === assignedId;
}

module.exports = { assignedBranchId, isAllowedBranch };
