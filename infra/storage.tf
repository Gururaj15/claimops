# Illustrative only — not applied. See infra/README.md.
resource "google_storage_bucket" "claim_documents" {
  name     = "claimops-claim-documents"
  location = "US"
  uniform_bucket_level_access = true
}
