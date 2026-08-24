# Illustrative only — not applied. See infra/README.md.
resource "google_cloud_run_v2_service" "fraud_ml_service" {
  name     = "claimops-fraud-ml"
  location = "us-central1"

  template {
    containers {
      image = "gcr.io/PROJECT_ID/claimops-fraud-ml:latest"
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
    }
  }
}
