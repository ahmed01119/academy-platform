# Unresolved Requirements

These must be answered before or during early feature sprints. Do not invent production behavior for them.

## Tenancy & organization

1. Is a **tenant** a legal entity, a brand, or a franchise network that may contain multiple brands?
2. Can one user belong to multiple tenants (e.g. consultant coaches)?
3. Are **branches** strictly physical locations, or also virtual programs?

## Privacy & children

4. Exact parental consent capture and evidence retention under Egypt PDPL (and future EU/UK rules).
5. Data retention / erasure SLA for minors after withdrawal.
6. Who can export a child's full record (parent, academy admin, platform support)?

## Finance

7. Merchant of record for fees (academy vs platform).
8. EGP-only at launch vs multi-currency from day one.
9. Refund, discount, and scholarship audit requirements.

## Access control

10. Complete role matrix: platform ops, owner, branch manager, coach, parent, player (if any).
11. MFA requirements for staff with financial privileges.

## Sport model

12. Football-specific entities first vs fully generic sport plugin model.
13. Shared vs sport-specific attendance and performance metrics.

## Infrastructure & compliance

14. Data residency: must Egyptian tenant data remain in-region?
15. Preferred AuthN approach (self-hosted vs managed IdP).
16. Offline requirements for Flutter (sync conflict policy).
