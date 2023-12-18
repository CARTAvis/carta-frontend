**Description**

linked issues and companion PRs (if there are), what is implemented or fixed, how to test it, …

**Checklist**

For linked issues (if there are):
- [ ] assignee and label added
- [ ] ZenHub issue connection, board status, and estimate updated

For the pull request:
- [ ] reviewers and assignee added
- [ ] ZenHub estimate, milestone, and release (if needed) added
- [ ] changelog updated / no changelog update needed
- [ ] unit test added (for functions with no dependenies)
- [ ] API documentation added (for public variables and methods in stores)

For dependencies:
- [ ] e2e test passing / corresponding fix added / new e2e test created
- [ ] protobuf version bumped / no protobuf version bumped needed
- [ ] protobuf updated to the latest dev commit / no protobuf update needed
- [ ] corresponding ICD test fix added (`BackendService` changed) / no ICD test fix needed (`BackendService` unchanged)
- [ ] user manual prepared (for large new features)