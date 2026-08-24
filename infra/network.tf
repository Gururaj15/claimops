# Illustrative only — not applied. See infra/README.md.
resource "google_compute_network" "claimops_vpc" {
  name                    = "claimops-vpc"
  auto_create_subnetworks = true
}
