# Real Bugs Found

BUG ID: B-001
Feature: Tenancy
Location: active-workspace-travels.test.ts
Test that caught it: MCP Approval test
Behavior: Missing workspaceId context on execution
Reproduction: Run MCP approval via API
Severity: P1
Evidence: Test assertion failure (previously discovered)
Regression test: N/A (Test exists but fails)
Status: OPEN
