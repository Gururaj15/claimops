# Illustrative only — not applied. See infra/README.md.
resource "google_service_account" "claimops_app" {
  account_id   = "claimops-app"
  display_name = "ClaimOps application service account"
}
